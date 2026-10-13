/**
 * Claim reads. Components never call the SDK directly; they call these.
 *
 * Each function returns a ReadResult so the UI can label whether the data came
 * from the live chain or from the committed snapshot.
 */

import { CONTRACT_ADDRESS, METHODS } from "../config/contracts";
import { readWithFallback, SNAPSHOT, liveRead, type ReadResult } from "./rpc";
import type {
  CheckResult,
  Claim,
  ClaimBundle,
  Dispute,
  EvidenceRecord,
  Policy,
  Settlement,
  SourceDef,
} from "../domain/types";
import { toNumber } from "../domain/format";

/** Cast an RPC value to a domain type without lying about its shape. */
function as<T>(value: unknown): T {
  return value as T;
}

/**
 * Claim ids are sequential ("claim-1", "claim-2", ...) by construction of
 * `start_claim`. The count comes from the chain; the ids are derived from it.
 */
export async function listClaimIds(): Promise<ReadResult<string[]>> {
  const snapshotIds = Object.keys(SNAPSHOT.claims).sort(
    (a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]),
  );
  const result = await readWithFallback<number>(METHODS.get_claim_count, SNAPSHOT.claimCount);
  const count = toNumber(result.data);
  const ids = Array.from({ length: count }, (_, i) => `claim-${i + 1}`);
  // If the chain is unreachable the snapshot may hold claims the chain does not.
  return {
    data: result.origin === "live" ? ids : snapshotIds,
    origin: result.origin,
    capturedAt: result.capturedAt,
    liveError: result.liveError,
  };
}

export async function listClaims(): Promise<ReadResult<Claim[]>> {
  const ids = (await listClaimIds()).data ?? [];
  const snapshotClaims = ids
    .map((id) => SNAPSHOT.claims[id]?.claim)
    .filter(Boolean)
    .map((c) => as<Claim>(c));

  // One `list_claims` read replaces the old get_claim_count + N×get_claim fan-out,
  // which mattered against the 30 req/min public RPC. Normalise scaled fields.
  const result = await readWithFallback<Claim[]>(METHODS.list_claims, snapshotClaims);
  const normalised = (result.data ?? []).map((c) => ({
    ...c,
    observed_value_scaled: toNumber(c.observed_value_scaled),
    eval_round: toNumber(c.eval_round),
  }));

  if (!normalised.length) return { data: snapshotClaims, origin: "snapshot", liveError: result.liveError };
  return {
    data: normalised,
    origin: result.origin,
    capturedAt: result.origin === "snapshot" ? SNAPSHOT.capturedAt : undefined,
    liveError: result.liveError,
  };
}

export async function getClaim(claimId: string): Promise<ReadResult<Claim | undefined>> {
  return readWithFallback<Claim>(
    METHODS.get_claim,
    SNAPSHOT.claims[claimId]?.claim as Claim | undefined,
    [claimId],
  );
}

export async function getEvidence(
  claimId: string,
): Promise<ReadResult<EvidenceRecord[] | undefined>> {
  return readWithFallback<EvidenceRecord[]>(
    METHODS.get_evidence,
    (SNAPSHOT.claims[claimId]?.evidence as EvidenceRecord[]) ?? [],
    [claimId],
  );
}

export async function getChecks(
  claimId: string,
): Promise<ReadResult<CheckResult[] | undefined>> {
  return readWithFallback<CheckResult[]>(
    METHODS.get_checks,
    (SNAPSHOT.claims[claimId]?.checks as CheckResult[]) ?? [],
    [claimId],
  );
}

export async function getDisputes(claimId: string): Promise<ReadResult<Dispute[] | undefined>> {
  return readWithFallback<Dispute[]>(
    METHODS.get_disputes,
    (SNAPSHOT.claims[claimId]?.disputes as Dispute[]) ?? [],
    [claimId],
  );
}

export async function getSettlement(claimId: string): Promise<ReadResult<Settlement | undefined>> {
  return readWithFallback<Settlement>(
    METHODS.get_settlement,
    SNAPSHOT.claims[claimId]?.settlement as Settlement | undefined,
    [claimId],
  );
}

/**
 * Assemble everything the claim screen needs. Reads run in sequence because the
 * public RPC is rate-limited; the service layer owns that constraint so the
 * components do not have to know about it.
 */
export async function getClaimBundle(claimId: string): Promise<ReadResult<ClaimBundle | undefined>> {
  const [claimRes, evidenceRes, checksRes, disputesRes, settlementRes] = await Promise.all([
    getClaim(claimId),
    getEvidence(claimId),
    getChecks(claimId),
    getDisputes(claimId),
    getSettlement(claimId),
  ]);

  if (!claimRes.data) {
    return { data: undefined, origin: claimRes.origin, liveError: claimRes.liveError };
  }

  // The policy is referenced by id; resolve it from the policy list.
  const policy = await resolvePolicy(claimRes.data.policy_id);

  const origins = [
    claimRes.origin,
    evidenceRes.origin,
    checksRes.origin,
    disputesRes.origin,
    settlementRes.origin,
    policy.origin,
  ];
  // "live" only if EVERY read was live; "mixed" if some were and some fell back.
  // Never label a partially-live bundle simply "live" — that overstates it.
  const origin = origins.every((o) => o === "live")
    ? "live"
    : origins.some((o) => o === "live")
      ? "mixed"
      : "snapshot";
  const liveError = [claimRes.liveError, evidenceRes.liveError, checksRes.liveError].find(Boolean);

  const bundle: ClaimBundle = {
    claim: claimRes.data,
    policy: policy.data as Policy,
    evidence: evidenceRes.data ?? [],
    checks: checksRes.data ?? [],
    disputes: disputesRes.data ?? [],
    settlement: (settlementRes.data ?? {
      claim_id: claimId,
      state: "not_settled",
      amount: 0,
      beneficiary: "",
      finalized: false,
    }) as Settlement,
  };

  return {
    data: bundle,
    origin,
    capturedAt: origin === "snapshot" ? SNAPSHOT.capturedAt : undefined,
    liveError,
  };
}

/** Policies change rarely, so resolve by id from the cached policy list. */
let policyListCache: ReadResult<Policy[]> | null = null;

export async function listPolicies(force = false): Promise<ReadResult<Policy[]>> {
  if (!force && policyListCache) return policyListCache;
  const snapshotPolicies = (SNAPSHOT.policies as Policy[]) ?? [];
  const result = await readWithFallback<Policy[]>(METHODS.list_policies, snapshotPolicies);
  const normalised = {
    ...result,
    data: (result.data ?? []).map((p) => ({
      ...p,
      lat_scaled: toNumber(p.lat_scaled),
      lon_scaled: toNumber(p.lon_scaled),
      threshold_scaled: toNumber(p.threshold_scaled),
      tolerance_m: toNumber(p.tolerance_m),
      payout_amount: toNumber(p.payout_amount),
      claim_count: toNumber(p.claim_count),
    })),
  };
  policyListCache = normalised;
  return normalised;
}

export async function resolvePolicy(policyId: string): Promise<ReadResult<Policy | undefined>> {
  const list = await listPolicies();
  return {
    data: (list.data ?? []).find((p) => p.id === policyId),
    origin: list.origin,
    capturedAt: list.capturedAt,
    liveError: list.liveError,
  };
}

export async function listSources() {
  return readWithFallback(METHODS.list_sources, (SNAPSHOT.sources as never[]) ?? []);
}

/** Contract owner address. Needed by the create-policy form: the contract's
 * `create_policy` is owner-only and reverts with "EXPECTED: not owner". */
export async function getOwner(): Promise<ReadResult<string | undefined>> {
  return readWithFallback<string>(METHODS.get_owner, SNAPSHOT.owner);
}

/** Live-first policy count. Used after a create_policy write to resolve the
 * new sequential id (policy-{count}) without guessing. */
export async function getPolicyCount(): Promise<ReadResult<number | undefined>> {
  return readWithFallback<number>(METHODS.get_policy_count, SNAPSHOT.policyCount);
}

/** Existing claim for an exact (policy, period) key, or "" when there is none.
 * Mirrors the contract's `find_claim` view; used to warn about duplicates
 * before the user sends a start_claim write. */
export async function findClaim(
  policyId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReadResult<string | undefined>> {
  return readWithFallback<string>(METHODS.find_claim, "", [policyId, periodStart, periodEnd]);
}

/* --- snapshot seeds ------------------------------------------------------
 * These let a page paint real recorded data on the first frame instead of
 * showing a skeleton for the ten seconds the rate-limited round trip takes.
 * They are the same values readWithFallback would use anyway, so nothing is
 * invented and the live read replaces them as soon as it lands.
 * ---------------------------------------------------------------------- */

export function snapshotClaims(): Claim[] {
  return Object.values(SNAPSHOT.claims)
    .map((c) => c.claim as Claim)
    .filter(Boolean)
    .sort((a, b) => Number(a.id.split("-")[1]) - Number(b.id.split("-")[1]));
}

export function snapshotClaimBundle(claimId: string): ClaimBundle | undefined {
  const entry = SNAPSHOT.claims[claimId];
  if (!entry) return undefined;
  const claim = entry.claim as Claim;
  const policy = (SNAPSHOT.policies as Policy[]).find((p) => p.id === claim.policy_id);
  return {
    claim,
    policy: policy as Policy,
    evidence: (entry.evidence ?? []) as EvidenceRecord[],
    checks: (entry.checks ?? []) as CheckResult[],
    disputes: (entry.disputes ?? []) as Dispute[],
    settlement: (entry.settlement ?? {
      claim_id: claimId,
      state: "not_settled",
      amount: 0,
      beneficiary: "",
      finalized: false,
    }) as Settlement,
  };
}

export function snapshotSources(): SourceDef[] {
  return (SNAPSHOT.sources as SourceDef[]) ?? [];
}

export function snapshotPolicies(): Policy[] {
  return (SNAPSHOT.policies as Policy[]) ?? [];
}

/** Snapshot seed for the owner read. */
export function snapshotOwner(): string {
  return SNAPSHOT.owner;
}

export async function getContractAddressLabel(): Promise<string> {
  return CONTRACT_ADDRESS;
}

export { liveRead };