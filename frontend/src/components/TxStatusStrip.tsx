import type { TxPhase } from "../services/txStatus";
import { PHASE_ICON, phaseText, phaseHint, isTerminal } from "../services/txStatus";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  phase: TxPhase;
  /** The contract's own finality flag. Distinct from the tx phase. */
  finalized: boolean;
  /**
   * Whether the contract has recorded a decision at all. A decided claim is
   * accepted-but-appealable even when no transaction was sent from this browser
   * session, which is the normal case for a claim read cold.
   */
  hasDecision?: boolean;
  hash?: string;
}

/**
 * Finality chip.
 *
 * Two visible levels, never conflated:
 *   - "Accepted — can still be appealed" (not permanent)
 *   - "Final" (permanent)
 *
 * This is the contract's `finalized` flag, not the SDK's tx status. A
 * transaction can be FINALIZED while the claim itself is still appealable, and
 * vice versa, so both are surfaced rather than inferred from one another.
 */
export function TxStatusStrip({ phase, finalized, hasDecision, hash }: Props) {
  const { t } = useI18n();

  const chip = finalized
    ? { text: t("tx.final.final"), icon: "●", cls: "finality-final" }
    : hasDecision || claimIsDecided(phase)
      ? { text: t("tx.final.accepted"), icon: "◕", cls: "finality-accepted" }
      : {
          text: t("tx.final.notYet"),
          icon: PHASE_ICON[phase],
          cls: phase === "failed" ? "finality-failed" : "finality-pending",
        };

  return (
    <div className="finality">
      <span className={`finality-chip ${chip.cls}`} data-testid="finality-chip">
        <span aria-hidden="true">{chip.icon}</span>
        {chip.text}
      </span>
      {hash ? <span className="small muted mono">{hash.slice(0, 12)}…</span> : null}
      {phase !== "idle" && !finalized ? (
        <span className="small muted" role="status">
          {phaseText(phase)}
          {phaseHint(phase) ? ` — ${phaseHint(phase)}` : ""}
          {isTerminal(phase) ? "" : ""}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A decision exists once the contract recorded one. Anything after that can be
 * accepted, and only `finalized` makes it permanent.
 */
function claimIsDecided(phase: TxPhase): boolean {
  return phase === "accepted" || phase === "finalized";
}