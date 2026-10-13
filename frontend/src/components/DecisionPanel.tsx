import type { Claim, Decision, ReasonCode } from "../domain/types";
import { decisionCopy, errorDetail, mapError, reasonCopy, stateCopy } from "../domain/copy";
import { fromScaled, periodLabel } from "../domain/format";
import type { Policy } from "../domain/types";
import { TxStatusStrip } from "./TxStatusStrip";

interface Props {
  claim: Claim;
  policy: Policy;
  /** Live tx lifecycle, when a write is in flight or has resolved. */
  txPhase?: "idle" | "submitted" | "pending" | "accepted" | "finalized" | "failed";
  /** Stable error from the contract, if the last evaluation could not run. */
  evalError?: string;
}

const TONE_ICON: Record<string, string> = {
  confirmed: "✓",
  "not-confirmed": "✕",
  inconclusive: "?",
};

/**
 * Decision block. The first thing read on the claim screen.
 *
 * Rules enforced here:
 *  - plain words, never a raw enum;
 *  - `inconclusive` is styled as a result with an explanation, never an error;
 *  - accepted and final are visually and textually distinct;
 *  - the contract's own summary is shown when present, because it is written
 *    for a policy holder and is part of the auditable record.
 */
export function DecisionPanel({ claim, policy, txPhase = "idle", evalError = "" }: Props) {
  const copy = decisionCopy(claim.decision as Decision);
  const reason = reasonCopy(claim.reason_code as ReasonCode);
  const state = stateCopy(claim.state);

  return (
    <section className={`decision decision-${copy.tone}`} aria-labelledby="decision-heading">
      <p className="eyebrow">Decision</p>
      <h2 className="decision-label" id="decision-heading">
        <span aria-hidden="true">{TONE_ICON[copy.tone]}</span>
        {copy.label}
      </h2>

      <p className="decision-reason">{reason.text}</p>

      {copy.tone === "inconclusive" && reason.resolve ? (
        <p className="decision-resolve">{reason.resolve}</p>
      ) : null}

      {claim.summary ? (
        <p className="small" data-testid="decision-summary">
          <strong>In the validator's words:</strong> {claim.summary}
        </p>
      ) : null}

      {evalError ? (
        <div className="alert alert-warn" role="status" data-testid="eval-error">
          <strong>This evaluation did not complete</strong>
          <p>{mapError(evalError).message}</p>
          <details className="disclosure">
            <summary>Details</summary>
            <p className="small muted">
              The stable contract error string is{" "}
              <code>{errorDetail(evalError)}</code>. Retrying usually works when the source was
              temporarily unavailable.
            </p>
          </details>
        </div>
      ) : null}

      <dl className="terms">
        <dt>Claim state</dt>
        <dd>{state.label}</dd>
        <dt>Highest reading</dt>
        <dd className="num">
          {fromScaled(claim.observed_value_scaled)} {policy.unit}
        </dd>
        <dt>Threshold</dt>
        <dd className="num">
          {policy.comparator} {fromScaled(policy.threshold_scaled)} {policy.unit}
        </dd>
        <dt>Observation period</dt>
        <dd className="num">
          {periodLabel(policy.period_start, policy.period_end)} {policy.timezone}
        </dd>
        <dt>Evaluation round</dt>
        <dd className="num">{claim.eval_round}</dd>
      </dl>

      <TxStatusStrip phase={txPhase} finalized={claim.finalized} hasDecision={Boolean(claim.decision)} />
    </section>
  );
}