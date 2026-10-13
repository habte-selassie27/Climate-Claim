import type { Claim, ClaimState, Dispute, SettlementState } from "../domain/types";
import { settlementCopy, stateCopy } from "../domain/copy";

interface Props {
  claim: Claim;
  disputes: Dispute[];
  settlement?: SettlementState;
}

/**
 * Claim timeline. This content really is a sequence, so numbering is
 * appropriate here and nowhere else in the UI.
 *
 * Steps are derived from the contract's state machine (docs/state-diagram.md):
 *   created -> evidence_collected -> pending_evaluation -> decided_* | inconclusive
 *   decided_* | inconclusive -> disputed -> decided_* | inconclusive
 *   decided_confirmed -> settled
 */
interface Step {
  key: string;
  name: string;
  blurb: string;
}

const STEPS: Step[] = [
  { key: "created", name: "Created", blurb: "The claim was opened against the policy." },
  {
    key: "evidence_collected",
    name: "Evidence collected",
    blurb: "The eligible sources were queried and their readings normalised.",
  },
  {
    key: "evaluated",
    name: "Evaluated",
    blurb: "Validators compared their independent results against the policy rules.",
  },
  { key: "disputed", name: "Disputed", blurb: "The decision was challenged and re-evaluated." },
  { key: "settled", name: "Settled", blurb: "The payout was transferred." },
];

/** How far along the machine this claim is, for step highlighting. */
function progress(state: ClaimState, disputeCount: number): number {
  switch (state) {
    case "created":
      return 0;
    case "evidence_collected":
    case "pending_evaluation":
      return 1;
    case "disputed":
      return 3;
    case "settled":
      return 4;
    case "decided_confirmed":
    case "decided_not_confirmed":
    case "inconclusive":
      // A claim that went through a dispute passes the dispute step too.
      return disputeCount > 0 ? 3 : 2;
    default:
      return 0;
  }
}

export function ClaimTimeline({ claim, disputes, settlement }: Props) {
  const current = progress(claim.state, disputes.length);
  const state = stateCopy(claim.state);

  return (
    <div>
      <div className="panel-head">
        <h3>Claim timeline</h3>
        <span className="badge">{state.label}</span>
      </div>

      <ol className="timeline" data-testid="claim-timeline">
        {STEPS.map((step, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const skipped = step.key === "disputed" && disputes.length === 0;
          const cls = isCurrent ? "timeline-current" : done ? "timeline-done" : "";
          return (
            <li key={step.key} className={`timeline-step ${cls}`}>
              <span className="step-marker" aria-hidden="true" />
              <div>
                <div className="step-name">
                  {step.name}
                  {isCurrent ? <span className="visually-hidden">(current state)</span> : null}
                  {skipped && !done ? (
                    <span className="required-tag">not used</span>
                  ) : null}
                </div>
                <p className="step-blurb">
                  {step.key === "evaluated" && claim.eval_round > 0
                    ? `${step.blurb} Round ${claim.eval_round}.`
                    : step.blurb}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
        {state.blurb}
      </p>

      {disputes.length > 0 ? (
        <div style={{ marginTop: "var(--space-4)" }}>
          <h4>Dispute history</h4>
          <div className="table-wrap">
            <table>
              <caption>Each round keeps the decision it replaced and the grounds that challenged it.</caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Grounds</th>
                  <th scope="col">Decision before</th>
                  <th scope="col">Decision after</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.round}>
                    <td className="num">{d.round}</td>
                    <td>{d.grounds}</td>
                    <td>{d.prev_decision || "none"}</td>
                    <td>{d.new_decision || "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {settlement ? (
        <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
          Settlement: {settlementCopy(settlement)}.
          {settlement === "not_settled"
            ? " A payout only happens once the decision is final, never on an merely accepted one."
            : ""}
        </p>
      ) : null}
    </div>
  );
}