import type { TxState } from "../services/txStatus";
import { PHASE_ICON, phaseText, phaseHint, isTerminal } from "../services/txStatus";
import { activeNetwork } from "../config/network";
import { mapError } from "../domain/copy";
import { CopyField } from "./CopyField";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  state: TxState;
  /** The action verb, so button, toast and status use the same word. */
  actionLabel: string;
  onRetry?: () => void;
  onRefresh?: () => void;
}

/**
 * Write lifecycle. Reads never use this component; only writes do.
 *
 * Every phase is visible, `accepted` is never rendered as `final`, and a failed
 * write says what happened and what to do next. The hash links through the
 * verified explorer route from network config, and `onRefresh` is whatever
 * re-checks this write on the page — the pages pair it with `refreshTx` so an
 * accepted result can actually reach `finalized`.
 */
export function TxStatusPanel({ state, actionLabel, onRetry, onRefresh }: Props) {
  const { t } = useI18n();
  const { phase, hash, error, retryable } = state;
  const net = activeNetwork();

  if (phase === "idle") return null;

  const mapped = error ? mapError(error) : null;

  return (
    <div
      className={`alert ${phase === "failed" ? "alert-error" : phase === "finalized" ? "alert-info" : "alert-warn"}`}
      role="status"
      aria-live="polite"
      data-testid="tx-status"
      data-phase={phase}
    >
      <strong>
        {actionLabel}: {phaseText(phase)}
      </strong>

      <p>
        <span aria-hidden="true">{PHASE_ICON[phase]}</span>{" "}
        {phase === "pending" || phase === "submitted"
          ? t("tx.hint.pending")
          : phase === "accepted"
            ? t("tx.hint.accepted")
            : phase === "finalized"
              ? t("tx.hint.finalized")
              : (mapped?.message ?? phaseHint("failed"))}
      </p>

      {hash ? (
        <CopyField
          value={hash}
          kind="hash"
          label={t("audit.txHash")}
          explorerUrl={net.explorerUrl}
          txPath={net.txPath}
          explorerAvailable={net.explorerAvailable}
          explorerNote={net.explorerNote}
        />
      ) : null}

      {phase === "failed" ? (
        <div className="btn-row">
          {retryable && onRetry ? (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              {mapped?.retryLabel ?? t("common.retry")}
            </button>
          ) : null}
          {onRefresh ? (
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              {t("tx.refresh")}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isTerminal(phase) && onRefresh ? (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            {t("tx.refresh")}
          </button>
        </div>
      ) : null}

      {error ? (
        <details className="disclosure">
          <summary>{t("common.details")}</summary>
          <p className="small muted mono">{error}</p>
        </details>
      ) : null}
    </div>
  );
}