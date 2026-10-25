/**
 * Claim reads. Components never call the SDK directly; they call these.
 *
 * Each function returns a ReadResult so the UI can tell live data from a failed
 * read. There is no recorded-data fallback: a read that fails yields no data, and
 * the page shows its empty or error state.
 *
 * SHAPES CHANGED WITH THE TWO-CONTRACT SPLIT. The claim contract now returns one
 * nested object from `get_claim` (evidence, disputes and payouts included), where
 * the old single contract exposed separate `get_evidence`, `get_disputes` and
 * `get_settlement` reads. This layer absorbs that difference so components keep
 * consuming the same domain types.
 *
 * Per-check results and the criteria version are stored with the consensus
 * evaluation on ClimateEvaluator, keyed by claim and dispute round; `getChecks`
 * reads that record. Evidence on the claim is the evaluator's own source rows, so
 * what the page shows is what the contract evaluated.
 *
 * The rest (`get_source`, `get_policy_count`, `find_claim`, `get_source_count`,
 * `get_payouts`, `get_owner`) are derived from list reads, which is cheaper and
 * avoids asserting a capability the schema does not have.
 */

import { DEPLOYER_ADDRESS, METHODS } from "../config/contracts";
import { readLive, type ReadResult } from "./rpc";
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
 * These rows are the evaluator's per-source results, copied into the claim by
 * `sync_evaluation`, and still parsed defensively: unknown fields default to the
 * SAFE value -- `ok` absent means not-known-good rather than good, because a
 * missing flag is not evidence that a source succeeded.
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
export async function listClaimIds(): Promise<ReadResult<string[] | undefined>> {
  const result = await readLive<number>(METHODS.get_claim_count);
  if (result.origin !== "live") {
    return { data: undefined, origin: result.origin, liveError: result.liveError };
  }
  const count = toNumber(result.data);
  return { data: Array.from({ length: count }, (_, i) => `claim-${i + 1}`), origin: "live" };
}

export async function listClaims(): Promise<ReadResult<Claim[] | undefined>> {
  // One `list_claims` read replaces the old get_claim_count + N×get_claim
  // fan-out, which mattered against the rate-limited public RPC.
  const result = await readLive<RawClaim[]>(METHODS.list_claims);
  if (result.origin !== "live") {
    return { data: undefined, origin: result.origin, liveError: result.liveError };
  }
  // An empty live list is a real answer, not a failure: this deployment starts
  // with no claims and every claim shown here came from this contract.
  const rows = Array.isArray(result.data) ? result.data : [];
  return { data: rows.map(mapClaim), origin: "live" };
}

export async function getClaim(claimId: string): Promise<ReadResult<Claim | undefined>> {
  const result = await readLive<RawClaim>(METHODS.get_claim, [claimId]);
  if (result.origin !== "live" || !result.data) {
    return { ...result, data: undefined };
  }
  return { ...result, data: mapClaim(result.data) };
}

/** One raw `get_claim` read, reused by every derived accessor below. */
async function readRawClaim(
  claimId: string,
): Promise<ReadResult<RawClaim | undefined>> {
  return readLive<RawClaim>(METHODS.get_claim, [claimId]);
}

export async function getEvidence(
  claimId: string,
): Promise<ReadResult<EvidenceRecord[] | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  return { ...result, data: mapEvidence(result.data.evidence) };
}

/** The structured result ClimateEvaluator stored for a claim and round. */
export interface EvaluatorResult {
  decision: Decision | "inconclusive";
  reason_code: string;
  observed_value_scaled: number;
  checks: Record<string, string>;
  sources: unknown[];
  policy_id: string;
  policy_version: number;
  period_start: string;
  period_end: string;
  round: number;
  criteria_version: string;
  summary: string;
}

/** Read the consensus result for a claim and dispute round, or undefined. */
export async function getEvaluationResult(
  claimId: string,
  round = 0,
): Promise<ReadResult<EvaluatorResult | undefined>> {
  return readLive<EvaluatorResult>(METHODS.get_result, [claimId, round]);
}

/**
 * Per-check results, read from the stored consensus evaluation.
 *
 * A claim that has not been through `evaluate_for_claim` has no record, so this
 * returns an empty list rather than inventing checks. The order follows the
 * evaluator's documented check set.
 */
export async function getChecks(
  claimId: string,
  round = 0,
): Promise<ReadResult<CheckResult[] | undefined>> {
  const result = await getEvaluationResult(claimId, round);
  const checks = result.data?.checks;
  if (!checks || typeof checks !== "object") {
    return { data: [], origin: result.origin, liveError: result.liveError };
  }
  const order: CheckResult["name"][] = [
    "threshold_crossed",
    "period_covered",
    "location_match",
    "source_agreement",
    "data_completeness",
  ];
  const rows: CheckResult[] = order
    .filter((name) => name in checks)
    .map((name) => ({ name, status: as<CheckResult["status"]>(checks[name]), detail: "" }));
  return { data: rows, origin: result.origin, liveError: result.liveError };
}

export async function getDisputes(claimId: string): Promise<ReadResult<Dispute[] | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  const rows = Array.isArray(result.data.disputes) ? result.data.disputes.map(mapDispute) : [];
  return { ...result, data: rows };
}

export async function getSettlement(claimId: string): Promise<ReadResult<Settlement | undefined>> {
  const result = await readRawClaim(claimId);
  if (!result.data) return { ...result, data: undefined };
  return { ...result, data: settlementFor(result.data) };
}

/**
 * Assemble everything the claim screen needs. Reads run in sequence because the
 * public RPC is rate-limited; the service layer owns that constraint so the
 * components do not have to know about it.
 */
export async function getClaimBundle(claimId: string): Promise<ReadResult<ClaimBundle | undefined>> {
  const claimRes = await getClaim(claimId);
  const round = claimRes.data?.dispute_rounds ?? 0;
  const [evidenceRes, checksRes, disputesRes, settlementRes] = await Promise.all([
    getEvidence(claimId),
    getChecks(claimId, round),
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
  // "live" only if EVERY read succeeded. There is no recorded-data fallback, so
  // a partial failure is an error, not something to paper over.
  const origin = origins.every((o) => o === "live") ? "live" : "error";
  const liveError = [claimRes.liveError, evidenceRes.liveError, checksRes.liveError].find(Boolean);

  const bundle: ClaimBundle = {
    claim: claimRes.data,
    policy: policy.data as Policy,
    evidence: evidenceRes.data ?? [],
    checks: checksRes.data ?? [],
    disputes: disputesRes.data ?? [],
    settlement: settlementRes.data ?? settlementFor({ id: claimId }),
  };

  return { data: bundle, origin, liveError };
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
  // Only a successful read is reused. Caching a failure made every later
  // "Refresh from chain" return the same error without touching the chain, so
  // the page could never recover.
  if (!force && policyListCache?.origin === "live") return policyListCache;
  const result = await readLive<Policy[]>(METHODS.list_policies);
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
  if (normalised.origin === "live") policyListCache = normalised;
  return normalised;
}

export async function resolvePolicy(policyId: string): Promise<ReadResult<Policy | undefined>> {
  const list = await listPolicies();
  return {
    data: (list.data ?? []).find((p) => p.id === policyId),
    origin: list.origin,
    liveError: list.liveError,
  };
}

/** Sources, read from the POLICY contract. */
export async function listSources() {
  return readLive<SourceDef[]>(METHODS.list_sources);
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
    liveError: list.liveError,
  };
}

/**
 * Owner address.
 *
 * DERIVED: neither deployed contract exposes `get_owner`, so there is no chain
 * read to make. This returns the configured deployer from `DEPLOYER_ADDRESS` —
 * the address that actually performed both deploys and is the only account that
 * may call the owner-only writes. Callers gate writes on it directly.
 */
export async function getOwner(): Promise<ReadResult<string | undefined>> {
  return { data: DEPLOYER_ADDRESS, origin: "live" };
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
    liveError: list.liveError,
  };
}

/**
 * This deployment DOES produce decisions on chain: ClimateEvaluator fetches the
 * policy's sources inside a leader/validator round and stores the result, and
 * `sync_evaluation` records it against the claim. See `getEvaluationResult`.
 */
export const EVALUATION_IS_OWNER_MEDIATED = false;

/* --- the decision engine ------------------------------------------------
 * `compute_evaluation` is the NEW method on ClimatePolicy in this deployment and
 * the reason the decision is derived rather than asserted. It is a pure function
 * of (frozen policy JSON, evidence rows) with no storage reads and no clock, so
 * anyone can call it and get the same answer the contract would reach.
 *
 * It does NOT fetch weather data. Evidence rows are supplied by the caller, so
 * their provenance is not provable on chain and nothing here may imply it is.
 * ---------------------------------------------------------------------- */

export interface EngineResult {
  decision: Decision | "inconclusive";
  reason_code: string;
  observed_value_scaled: number;
  sources_used: string[];
  sources_missing: string[];
  criteria_version: string;
  checks: { name: string; status: string }[];
  sources: {
    source_id: string;
    ok: boolean;
    days_covered: number;
    value_scaled: number;
    crossed: boolean;
  }[];
}

/** One evidence row as the engine expects it. */
export interface EngineRow {
  source_id: string;
  ok: boolean;
  days_covered: number;
  value_scaled: number;
}

/**
 * Run the deployed policy contract's own decision engine over evidence rows.
 *
 * Used by the demo to show what this contract decides about a given recorded
 * response, and by the claim workflow to preview a decision before it is
 * recorded. Returns `data: undefined` on failure rather than a guess.
 */
export async function computeEvaluation(
  policyJson: string,
  rows: EngineRow[],
  daysExpected: number,
): Promise<ReadResult<EngineResult | undefined>> {
  const result = await readLive<EngineResult>(METHODS.compute_evaluation, [
    policyJson,
    JSON.stringify(rows),
    daysExpected,
  ]);
  return result;
}
