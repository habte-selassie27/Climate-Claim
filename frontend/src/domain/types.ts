/**
 * Domain types.
 *
 * These mirror the shapes returned by the deployed contract. Field names come
 * from the saved schema and from real read output captured on 2026-10-13; the
 * union members come from the contract's own constants (contracts/climateclaim.py
 * lines 59-131), not from guesswork.
 */

export type Decision = "confirmed" | "not_confirmed" | "inconclusive";

export type ReasonCode =
  | "threshold_crossed"
  | "threshold_not_crossed"
  | "source_conflict"
  | "missing_observations"
  | "location_mismatch"
  | "sources_unreachable"
  | "none";

export type CheckStatus = "pass" | "fail" | "unclear";

export type CheckName =
  | "threshold_crossed"
  | "period_covered"
  | "location_match"
  | "source_agreement"
  | "data_completeness";

export type ClaimState =
  | "created"
  | "pending_evaluation"
  | "evidence_collected"
  | "decided_confirmed"
  | "decided_not_confirmed"
  | "inconclusive"
  | "disputed"
  | "settled";

export type SettlementState =
  | "not_settled"
  | "settling"
  | "settled"
  | "settlement_failed";

export type DataMode = "historical_simulation" | "live";

export type Aggregation =
  | "max_single"
  | "daily_total"
  | "cumulative"
  | "consecutive_days";

export type Comparator = "gt" | "gte" | "lt" | "lte";

/** Checks the contract treats as required when judging equivalence. */
export const REQUIRED_CHECKS: readonly CheckName[] = [
  "threshold_crossed",
  "period_covered",
  "data_completeness",
];

export interface Policy {
  id: string;
  owner: string;
  beneficiary: string;
  location_name: string;
  lat_scaled: number;
  lon_scaled: number;
  tolerance_m: number;
  source_ids: string[];
  agreement_rule: string;
  min_sources: number;
  data_mode: DataMode;
  period_start: string;
  period_end: string;
  timezone: string;
  metric: string;
  unit: string;
  comparator: Comparator;
  threshold_scaled: number;
  aggregation: Aggregation;
  condition_text: string;
  payout_amount: number;
  status: "active" | "retired";
  claim_count: number;
}

export interface Claim {
  id: string;
  policy_id: string;
  claimant: string;
  state: ClaimState;
  decision: Decision | "";
  reason_code: ReasonCode | "";
  observed_value_scaled: number;
  summary: string;
  criteria_version: string;
  eval_round: number;
  finalized: boolean;
  settlement_state: SettlementState;
  /** Stable error prefix such as "EXTERNAL: sources_unreachable". Empty when ok. */
  eval_error: string;
  /**
   * Grounds of the currently-open dispute, set by `open_dispute` and cleared
   * once the re-evaluation records the round. Empty unless state is "disputed".
   * Mirrors the contract's `pending_grounds` (contracts/climateclaim.py).
   */
  pending_grounds?: string;
}

export interface EvidenceRecord {
  source_id: string;
  ok: boolean;
  error: string;
  station: string;
  period_start: string;
  period_end: string;
  unit: string;
  /** Aggregated per the policy's aggregation rule. Scaled by SCALE_DECIMALS. */
  value_scaled: number;
  days_covered: number;
  crossed: boolean;
}

export interface CheckResult {
  name: CheckName;
  status: CheckStatus;
  detail: string;
}

/**
 * One recorded dispute round, exactly as `get_disputes` returns it
 * (contracts/climateclaim.py `_write_outcome`): round, opener, grounds,
 * prev_decision, new_decision. Written when the re-evaluation lands.
 */
export interface Dispute {
  round: number;
  /** Address that opened the dispute (the claimant or the owner). */
  opener: string;
  /** The disputant's own words, preserved verbatim. */
  grounds: string;
  prev_decision: Decision | "";
  new_decision: Decision | "";
}

export interface Settlement {
  claim_id: string;
  state: SettlementState;
  amount: number;
  beneficiary: string;
  finalized: boolean;
}

export interface SourceDef {
  id: string;
  name: string;
  kind: string;
  metric: string;
  param: string;
  unit: string;
  url_template: string;
  attribution: string;
}

/**
 * A claim plus everything needed to render the claim screen, in one object.
 * Assembled by the service layer so components never call the SDK.
 */
export interface ClaimBundle {
  claim: Claim;
  policy: Policy;
  evidence: EvidenceRecord[];
  checks: CheckResult[];
  disputes: Dispute[];
  settlement: Settlement;
}