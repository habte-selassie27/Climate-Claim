/**
 * Audit receipt export.
 *
 * Assembles the full audit record for a claim — policy terms, per-source
 * evidence, per-check results, the decision and reason code, dispute history
 * and settlement state — and downloads it as a JSON file. This is the offline
 * companion to the claim page: a reviewer can re-check every statement the UI
 * made without trusting the UI.
 *
 * HONESTY RULES, same as the rest of the app:
 *   - every field is copied from the claim bundle the page already renders
 *     (which comes from the deployed contract, or from the recorded snapshot
 *     when live reads were unavailable) — nothing is reconstructed;
 *   - the record states which of the two it is (`provenance.record_origin`)
 *     and carries the snapshot capture time and any live-read error;
 *   - scaled integers are exported raw AND in their stated unit, so no reader
 *     needs to know the scaling convention;
 *   - transaction hashes: the contract does not store per-claim tx history, so
 *     the record carries only the write this session produced, if any.
 */

import { SCALE_DECIMALS } from "../config/contracts";
import { fromScaled, microDegrees } from "./format";
import type { ClaimBundle } from "./types";

/** Bumped when the exported shape changes, so consumers can branch on it. */
export const AUDIT_RECORD_VERSION = "climateclaim-audit-record-1";

export interface AuditRecordContext {
  /** Page read origin: "live", "snapshot" or "mixed" (see services/rpc). */
  origin: string;
  capturedAt?: string;
  liveError?: string;
  contractAddress: string;
  networkLabel: string;
  chainId: number;
  /** The write this session produced for this claim, if any. */
  sessionTxHash?: string;
  /** Explorer deep link for `sessionTxHash`, built from verified config only. */
  explorerUrl?: string | null;
  /** Injectable clock so tests are deterministic. */
  generatedAt?: string;
}

export interface AuditRecord {
  record_version: string;
  generated_at: string;
  claim: {
    id: string;
    policy_id: string;
    claimant: string;
    period_start: string | null;
    period_end: string | null;
    state: string;
    decision: string;
    reason_code: string;
    observed_value_scaled: number;
    observed_value: string;
    summary: string;
    criteria_version: string;
    eval_round: number;
    dispute_rounds: number;
    finalized: boolean;
    settlement_state: string;
    payout_round: number;
    recipient: string | null;
    eval_error: string;
    pending_grounds: string;
  };
  policy: {
    id: string;
    owner: string;
    beneficiary: string;
    location_name: string;
    latitude: string;
    longitude: string;
    lat_scaled: number;
    lon_scaled: number;
    tolerance_m: number;
    source_ids: string[];
    agreement_rule: string;
    min_sources: number;
    data_mode: string;
    period_start: string;
    period_end: string;
    timezone: string;
    metric: string;
    unit: string;
    comparator: string;
    threshold: string;
    threshold_scaled: number;
    aggregation: string;
    condition_text: string;
    payout_amount: number;
    status: string;
    claim_count: number;
  };
  evidence: Array<{
    source_id: string;
    ok: boolean;
    error: string;
    station: string;
    period_start: string;
    period_end: string;
    unit: string;
    value_scaled: number;
    value: string;
    days_covered: number;
    crossed: boolean;
  }>;
  checks: Array<{ name: string; status: string; detail: string }>;
  disputes: Array<{
    round: number;
    opener: string;
    grounds: string;
    prev_decision: string;
    new_decision: string;
  }>;
  settlement: {
    claim_id: string;
    state: string;
    amount: number;
    beneficiary: string;
    recipient: string;
    finalized: boolean;
    in_flight: boolean;
    payout_round: number;
    payouts: Array<{
      round: number;
      recipient: string;
      amount: number;
      outcome: string;
      reason: string;
    }>;
  };
  provenance: {
    contract_address: string;
    network: string;
    chain_id: number;
    data_mode: string;
    /** "live" | "mixed" | "recorded_snapshot" — mapped from the page's origin. */
    record_origin: string;
    snapshot_captured_at: string | null;
    live_error: string | null;
    session_transaction_hash: string | null;
    explorer_url: string | null;
    scale_decimals: number;
  };
}

export function buildAuditRecord(bundle: ClaimBundle, ctx: AuditRecordContext): AuditRecord {
  const { claim, policy, evidence, checks, disputes, settlement } = bundle;
  return {
    record_version: AUDIT_RECORD_VERSION,
    generated_at: ctx.generatedAt ?? new Date().toISOString(),
    claim: {
      id: claim.id,
      policy_id: claim.policy_id,
      claimant: claim.claimant,
      period_start: claim.period_start ?? null,
      period_end: claim.period_end ?? null,
      state: claim.state,
      decision: claim.decision,
      reason_code: claim.reason_code,
      observed_value_scaled: claim.observed_value_scaled,
      observed_value: fromScaled(claim.observed_value_scaled),
      summary: claim.summary,
      criteria_version: claim.criteria_version,
      eval_round: claim.eval_round,
      dispute_rounds: claim.dispute_rounds ?? 0,
      finalized: claim.finalized,
      settlement_state: claim.settlement_state,
      payout_round: claim.payout_round ?? 0,
      recipient: claim.recipient ?? null,
      eval_error: claim.eval_error,
      pending_grounds: claim.pending_grounds ?? "",
    },
    policy: {
      id: policy.id,
      owner: policy.owner,
      beneficiary: policy.beneficiary,
      location_name: policy.location_name,
      latitude: microDegrees(policy.lat_scaled),
      longitude: microDegrees(policy.lon_scaled),
      lat_scaled: policy.lat_scaled,
      lon_scaled: policy.lon_scaled,
      tolerance_m: policy.tolerance_m,
      source_ids: [...policy.source_ids],
      agreement_rule: policy.agreement_rule,
      min_sources: policy.min_sources,
      data_mode: policy.data_mode,
      period_start: policy.period_start,
      period_end: policy.period_end,
      timezone: policy.timezone,
      metric: policy.metric,
      unit: policy.unit,
      comparator: policy.comparator,
      threshold: fromScaled(policy.threshold_scaled),
      threshold_scaled: policy.threshold_scaled,
      aggregation: policy.aggregation,
      condition_text: policy.condition_text,
      payout_amount: policy.payout_amount,
      status: policy.status,
      claim_count: policy.claim_count,
    },
    evidence: evidence.map((e) => ({
      source_id: e.source_id,
      ok: e.ok,
      error: e.error,
      station: e.station,
      period_start: e.period_start,
      period_end: e.period_end,
      unit: e.unit,
      value_scaled: e.value_scaled,
      value: fromScaled(e.value_scaled),
      days_covered: e.days_covered,
      crossed: e.crossed,
    })),
    checks: checks.map((c) => ({ name: c.name, status: c.status, detail: c.detail })),
    disputes: disputes.map((d) => ({
      round: d.round,
      opener: d.opener,
      grounds: d.grounds,
      prev_decision: d.prev_decision,
      new_decision: d.new_decision,
    })),
    settlement: {
      claim_id: settlement.claim_id,
      state: settlement.state,
      amount: settlement.amount,
      beneficiary: settlement.beneficiary,
      recipient: settlement.recipient,
      finalized: settlement.finalized,
      in_flight: settlement.in_flight,
      payout_round: settlement.payout_round,
      payouts: settlement.payouts.map((p) => ({
        round: p.round,
        recipient: p.recipient,
        amount: p.amount,
        outcome: p.outcome,
        reason: p.reason ?? "",
      })),
    },
    provenance: {
      contract_address: ctx.contractAddress,
      network: ctx.networkLabel,
      chain_id: ctx.chainId,
      data_mode: policy.data_mode,
      record_origin: ctx.origin === "snapshot" ? "recorded_snapshot" : ctx.origin,
      snapshot_captured_at: ctx.capturedAt ?? null,
      live_error: ctx.liveError ?? null,
      session_transaction_hash: ctx.sessionTxHash ?? null,
      explorer_url: ctx.explorerUrl ?? null,
      scale_decimals: SCALE_DECIMALS,
    },
  };
}

/** "claim-2" -> "climateclaim-audit-claim-2.json"; ids are sanitised. */
export function auditRecordFilename(claimId: string): string {
  const safe = claimId.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `climateclaim-audit-${safe || "claim"}.json`;
}

/**
 * Trigger the browser download. Returns false when the needed browser APIs are
 * absent (server-side render, tests) or the download cannot be started — it
 * never throws, so a click can not crash the page.
 */
export function downloadAuditRecord(record: AuditRecord): boolean {
  if (
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = auditRecordFilename(record.claim.id);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
