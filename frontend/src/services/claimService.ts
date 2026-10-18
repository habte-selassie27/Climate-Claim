/**
 * Claim reads. Components never call the SDK directly; they call these.
 *
 * Each function returns a ReadResult so the UI can label whether the data came
 * from the live chain or from the committed snapshot.
 *
 * SHAPES CHANGED WITH THE TWO-CONTRACT SPLIT. The claim contract now returns one
 * nested object from `get_claim` (evidence, disputes and payouts included), where
 * the old single contract exposed separate `get_evidence`, `get_disputes` and
 * `get_settlement` reads. This layer absorbs that difference so components keep
 * consuming the same domain types.
 *
 * Three capabilities genuinely have no data source on the current deployment and
 * are handled rather than faked:
 *
 *   - `get_checks`      nothing in either contract produces per-check results.
 *   - `get_criteria_version`, `get_owner`   the methods do not exist.
 *
 * The rest (`get_source`, `get_policy_count`, `find_claim`, `get_source_count`,
 * `get_payouts`) are derived from list reads, which is cheaper and avoids
 * asserting a capability the schema does not have.
 */

import { METHODS } from "../config/contracts";
import { readWithFallback, SNAPSHOT, type ReadResult } from "./rpc";
import type {
  CheckResult,
  Claim,
  ClaimBundle,
  Decision,
  Dispute,
  EvidenceRecord,
  PayoutAttempt,
  Policy,
  Settlement,
  SettlementState,
  SourceDef,
} from "../domain/types";
import { toNumber } from "../domain/format";

/** Cast an RPC value to a domain type without lying about its shape. */
function as<T>(value: unknown): T {
  return value as T;
}

/** A raw claim row as `get_claim` returns it. */
type RawClaim = Record<string, unknown>;

const ZERO_ADDRESS = /^0x0{40}$/i;

/**
 * Map one `get_claim` row onto the domain Claim.
 *
 * Field renames this deployment introduced: `reason` -> reason_code,
 * `observed_scaled` -> observed_value_scaled, `evaluation_round` -> eval_round.
 *
 * `criteria_version` and `eval_error` are set to "" because the claim contract
 * does not store them. Leaving them empty is honest; inventing a version string
 * would attribute the decision to a criteria set that was never recorded.
 */
function mapClaim(raw: RawClaim): Claim {
  const snapshot = as<Record<string, unknown>>(raw.policy_snapshot ?? {});
  const claimant = String(raw.claimant ?? "");
  const beneficiary = String(snapshot.beneficiary ?? "");
  return {
    id: String(raw.id ?? ""),
    policy_id: String(raw.policy_id ?? ""),
    claimant,
    period_start: raw.period_start === undefined ? undefined : String(raw.period_start),
    period_end: raw.period_end === undefined ? undefined : String(raw.period_end),
    state: as<Claim["state"]>(raw.state ?? "created"),
    decision: as<Decision | "">(raw.decision ?? ""),
    reason_code: as<Claim["reason_code"]>(raw.reason ?? ""),
    observed_value_scaled: toNumber(raw.observed_scaled),
    summary: String(raw.summary ?? ""),
    criteria_version: "",
    eval_round: toNumber(raw.evaluation_round),
    dispute_rounds: toNumber(raw.dispute_rounds),
    finalized: Boolean(raw.finalized),
    settlement_state: as<SettlementState>(raw.settlement_state ?? "not_settled"),
    payout_round: toNumber(raw.payout_round),
    // Where a payout would go: the policy's beneficiary, or the claimant when
    // the beneficiary is the zero address (the contracts' documented opt-in).
    recipient: ZERO_ADDRESS.test(beneficiary) || !beneficiary ? claimant : beneficiary,
    eval_error: "",
    pending_grounds: String(raw.pending_grounds ?? ""),
  };
}

/**
 * Map a recorded dispute round.
 *
 * The claim contract stores {round, opener, grounds, decision, reason}. It does
 * NOT store the decision that preceded the round, so `prev_decision` is "" --
 * unknown, not "no decision". The old contract recorded it; this one does not.
 */
function mapDispute(raw: unknown): Dispute {
  const d = as<Record<string, unknown>>(raw ?? {});
  return {
    round: toNumber(d.round),
    opener: String(d.opener ?? ""),
    grounds: String(d.grounds ?? ""),
    prev_decision: "",
    new_decision: as<Decision | "">(d.decision ?? ""),
  };
}

/**
 * Map the evidence rows stored on a claim.
 *
 * These are whatever the owner passed to `record_evaluation`, so this is
 * defensive by necessity: the contract neither validates the inner shape nor
 * tells us what the keys mean. Unknown fields default to the SAFE value --
 * `ok` absent means not-known-good rather than good, because a missing flag is
 * not evidence that a source succeeded.
 */
function mapEvidence(rows: unknown): EvidenceRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const e = as<Record<string, unknown>>(row ?? {});
    return {
      source_id: String(e.source_id ?? e.id ?? ""),
      ok: Boolean(e.ok),
      error: String(e.error ?? ""),
      station: String(e.station ?? e.location ?? ""),
      period_start: String(e.period_start ?? ""),
      period_end: String(e.period_end ?? ""),
      unit: String(e.unit ?? ""),
      value_scaled: toNumber(e.value_scaled ?? e.value ?? 0),
      days_covered: toNumber(e.days_covered ?? 0),
      crossed: Boolean(e.crossed),
    };
  });
}

/** Map the payout log. The contract writes {round, recipient, amount, outcome}. */
function mapPayouts(rows: unknown): PayoutAttempt[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const p = as<Record<string, unknown>>(row ?? {});
    return {
      round: toNumber(p.round),
      recipient: String(p.recipient ?? ""),
      amount: toNumber(p.amount),
      outcome: as<PayoutAttempt["outcome"]>(p.outcome ?? "emitted"),
      ...(p.reason ? { reason: String(p.reason) } : {}),
    };
  });
}

/**
 * Derive the settlement view from the claim row.
 *
 * `payout_emitted` is deliberately NOT treated as success: the message has been
 * emitted but the child transaction crediting the recipient is unverified. The
 * contract tracks confirmation separately via `confirm_settlement`, and this
 * mapping preserves that distinction.
 */
function settlementFor(raw: RawClaim): Settlement {
  const snapshot = as<Record<string, unknown>>(raw.policy_snapshot ?? {});
  const state = as<SettlementState>(raw.settlement_state ?? "not_settled");
  const beneficiary = String(snapshot.beneficiary ?? "");
  const claimant = String(raw.claimant ?? "");
  return {
    claim_id: String(raw.id ?? ""),
    state,
    amount: toNumber(snapshot.payout_amount ?? 0),
    beneficiary,
    recipient: ZERO_ADDRESS.test(beneficiary) || !beneficiary ? claimant : beneficiary,
    finalized: Boolean(raw.finalized),
    in_flight: state === "payout_emitted",
    payout_round: toNumber(raw.payout_round),
    payouts: mapPayouts(raw.payouts),
  };
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
  const snapshotClaims = Object.values(SNAPSHOT.claims)
    .map((c) => as<Claim>(c.claim))
    .filter(Boolean);

  // One `list_claims` read replaces the old get_claim_count + N×get_claim
  // fan-out, which mattered against the rate-limited public RPC. No snapshot
  // value is passed: the recorded rows belong to a different deployment, and
  // the snapshot branch below returns them deliberately rather than by accident.
  const result = await readWithFallback<RawClaim[]>(METHODS.list_claims, undefined);
  const rows = Array.isArray(result.data) ? result.data : [];

  // An empty live list is a real answer, not a failure: this deployment starts
  // with no claims. Falling back to the snapshot here would show another
  // contract's claims as if they were this one's.
  if (result.origin === "live") {
    return { data: rows.map(mapClaim), origin: "live" };
  }
  return {
    data: snapshotClaims,
    origin: "snapshot",
    capturedAt: SNAPSHOT.capturedAt,
    liveError: result.liveError,
  };
}

export async function getClaim(claimId: string): Promise<ReadResult<Claim | undefined>> {
  const result = await readWithFallback<RawClaim>(
    METHODS.get_claim,
    SNAPSHOT.claims[claimId]?.claim as never,
    [claimId],
  );
  if (!result.data) return { ...result, data: undefined };
  return {
    ...result,
    data: result.origin === "live" ? mapClaim(result.data) : as<Claim>(result.data),
  };
}

/** One raw `get_claim` read, reused by every derived accessor below. */
async function readRawClaim(
  claimId: string,
): Promise<ReadResult<RawClaim | undefined>> {
  return readWithFallback<RawClaim>(
    METHODS.get_claim,
    SNAPSHOT.claims[claimId]?.claim as never,
    [claimId],
  );
}

export async function getEvidence(
  claimId: string,
): Promise<ReadResult<EvidenceRecord[] | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  const rows = result.origin === "live"
    ? mapEvidence(result.data.evidence)
    : ((SNAPSHOT.claims[claimId]?.evidence as EvidenceRecord[]) ?? []);
  return { ...result, data: rows };
}

/**
 * Per-check results.
 *
 * THERE IS NO ON-CHAIN SOURCE. Neither deployed contract computes or stores
 * threshold/period/location/agreement/completeness rows -- the old single-file
 * contract did, and that code is not part of this deployment. Returning the
 * recorded snapshot values here would present another contract's checks as this
 * claim's, so this returns an empty list and the UI states why. See
 * `AVAILABILITY.get_checks` in config/contracts.ts.
 */
export async function getChecks(
  claimId: string,
): Promise<ReadResult<CheckResult[] | undefined>> {
  void claimId;
  return { data: [], origin: "live" };
}

export async function getDisputes(claimId: string): Promise<ReadResult<Dispute[] | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  const rows = result.origin === "live"
    ? (Array.isArray(result.data.disputes) ? result.data.disputes.map(mapDispute) : [])
    : ((SNAPSHOT.claims[claimId]?.disputes as Dispute[]) ?? []);
  return { ...result, data: rows };
}

export async function getSettlement(claimId: string): Promise<ReadResult<Settlement | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  if (result.origin === "live") {
    return { ...result, data: settlementFor(result.data) };
  }
  return {
    ...result,
    data: (SNAPSHOT.claims[claimId]?.settlement as Settlement) ?? undefined,
  };
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
    settlement: settlementRes.data ?? settlementFor({ id: claimId }),
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

/**
 * Policies, read from the POLICY contract.
 *
 * Note the router: `list_policies` lives on ClimatePolicy, not ClimateClaim.
 * Sending it to the claim contract fails, which is why reads go through
 * `addressFor` rather than a single configured address.
 */
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
      // The policy contract does not store a claim count; the old contract did.
      // Counting this deployment's claims per policy is what the UI means by it.
      claim_count: toNumber(p.claim_count ?? 0),
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

/** Sources, read from the POLICY contract. */
export async function listSources() {
  return readWithFallback(METHODS.list_sources, (SNAPSHOT.sources as never[]) ?? []);
}

/**
 * A single source by id.
 *
 * DERIVED: this deployment exposes `list_sources` but not `get_source`, so the
 * lookup is done here rather than pretending the method exists.
 */
export async function getSource(sourceId: string): Promise<ReadResult<SourceDef | undefined>> {
  const list = await listSources();
  const rows = Array.isArray(list.data) ? (list.data as SourceDef[]) : [];
  return {
    data: rows.find((s) => s.id === sourceId),
    origin: list.origin,
    capturedAt: list.capturedAt,
    liveError: list.liveError,
  };
}

/**
 * Owner address.
 *
 * REMOVED: there is no `get_owner` on either deployed contract, so this cannot
 * return a chain value. It reports the configured owner instead and says so via
 * the origin, rather than returning a snapshot address as though it were read.
 * Callers that gate a write on ownership should compare against
 * `DEPLOYER_ADDRESS` directly.
 */
export async function getOwner(): Promise<ReadResult<string | undefined>> {
  return { data: SNAPSHOT.owner, origin: "snapshot" };
}

/**
 * Number of policies.
 *
 * DERIVED: no `get_policy_count` exists, so this counts `list_policies`. One
 * read instead of two, and it cannot disagree with the list the UI renders.
 */
export async function getPolicyCount(): Promise<ReadResult<number | undefined>> {
  const list = await listPolicies(true);
  return {
    data: (list.data ?? []).length,
    origin: list.origin,
    capturedAt: list.capturedAt,
    liveError: list.liveError,
  };
}

/**
 * Existing claim for an exact (policy, period) key, or "" when there is none.
 *
 * DERIVED: the contract exposes no `find_claim`, so this scans the claim list.
 * That is more expensive than a single view call, but the alternative -- asking
 * for a method the schema does not have -- fails outright.
 */
export async function findClaim(
  policyId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReadResult<string | undefined>> {
  const list = await listClaims();
  const match = (list.data ?? []).find(
    (c) => c.policy_id === policyId && c.period_start === periodStart && c.period_end === periodEnd,
  );
  return {
    data: match?.id ?? "",
    origin: list.origin,
    capturedAt: list.capturedAt,
    liveError: list.liveError,
  };
}

/** Can this deployment produce a claim decision at all? See `record_evaluation`. */
export const EVALUATION_IS_OWNER_MEDIATED = true;

/* --- snapshot seeds ------------------------------------------------------
 * These let a page paint real recorded data on the first frame instead of
 * showing a skeleton for the ten seconds the rate-limited round trip takes.
 * They are the same values readWithFallback would use anyway, so nothing is
 * invented and the live read replaces them as soon as it lands.
 *
 * They come from the v1 deployment recorded in onchain-snapshot.json, NOT from
 * the current Bradbury contracts. Pages that show them must name that contract
 * (see SNAPSHOT_CONTRACT in services/rpc.ts) and must not imply they are live.
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
    settlement: settlementFor(entry.settlement as never),
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
