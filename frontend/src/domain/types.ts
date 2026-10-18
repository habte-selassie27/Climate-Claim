/**
 * Domain types.
 *
 * These mirror the shapes returned by the deployed contract. Field names come
 * from the saved schema and from real read output captured on 2026-10-13; the
 * union members come from the contract's own constants (archive/climateclaim.py
 * lines 59-131), not from guesswork.
 *
 * Those constants belong to the evaluation design, which is archived rather than
 * deployed. The deployed claim contract records a decision instead of deriving
 * one, so `decision` and `reason_code` can hold whatever the owner supplied. The
 * unions below remain the vocabulary the UI is written against; treat a value
 * outside them as unrecognised rather than impossible.
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

/**
 * Settlement lifecycle (contracts/Climate-Claim.py). `payout_emitted` is NOT
 * success: the payout message has been emitted, but the child transaction that
 * actually credits the recipient has not been verified yet.
 */
export type SettlementState =
  | "not_settled"
  | "payout_emitted"
  | "settled"
  | "settlement_failed";

export type DataMode = "historical_simulation" | "live";

/**
 * Aggregations the contract accepts. `max_single` and `cumulative` are in the
 * metric's canonical unit (mm / °C); `consecutive_days` counts calendar days,
 * so a policy using it stores unit "days". `cumulative` is precipitation-only
 * because summing daily maximum temperatures is not a meaningful threshold.
 */
export type Aggregation = "max_single" | "cumulative" | "consecutive_days";

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
  /** The claim's OWN observation window: what evaluation reads, not the policy's. */
  period_start?: string;
  period_end?: string;
  state: ClaimState;
  decision: Decision | "";
  reason_code: ReasonCode | "";
  observed_value_scaled: number;
  summary: string;
  criteria_version: string;
  /** Completed dispute re-evaluations (0 until a dispute records an outcome). */
  eval_round: number;
  /** Disputes OPENED, which is what the per-claim limit counts. */
  dispute_rounds?: number;
  finalized: boolean;
  settlement_state: SettlementState;
  /** Payout attempts so far; each emitted message is its own attempt. */
  payout_round?: number;
  /** Where a payout would go: the beneficiary, or the claimant when the
   *  beneficiary is the zero address (the contract's documented opt-in). */
  recipient?: string;
  /** Stable error prefix such as "EXTERNAL: sources_unreachable". Empty when ok. */
  eval_error: string;
  /**
   * Grounds of the currently-open dispute, set by `open_dispute` and cleared
   * once the re-evaluation records the round. Empty unless state is "disputed".
   * Mirrors the contract's `pending_grounds` (contracts/Climate-Claim.py).
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
 * One recorded dispute round.
 *
 * The archived contract's `get_disputes` returned round, opener, grounds,
 * prev_decision and new_decision (archive/climateclaim.py `_write_outcome`). The
 * deployed claim contract records round, opener, grounds, decision and reason
 * instead -- it never stores the decision that preceded the round, so
 * `prev_decision` is always empty and `new_decision` carries the round's outcome.
 * services/claimService.ts does that mapping.
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

/** One payout attempt, as recorded by the contract's `get_settlement`. */
export interface PayoutAttempt {
  round: number;
  recipient: string;
  amount: number;
  outcome: "emitted" | "confirmed" | "failed";
  reason?: string;
}

export interface Settlement {
  claim_id: string;
  state: SettlementState;
  amount: number;
  beneficiary: string;
  recipient: string;
  finalized: boolean;
  /** True while a payout message is emitted but delivery is unverified. */
  in_flight: boolean;
  payout_round: number;
  payouts: PayoutAttempt[];
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