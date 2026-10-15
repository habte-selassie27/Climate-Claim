import type { TxState } from "../services/txStatus";
import { PHASE_ICON, PHASE_TEXT, isTerminal } from "../services/txStatus";
import { mapError } from "../domain/copy";
import { CopyField } from "./CopyField";

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
 * write says what happened and what to do next.
 */
export function TxStatusPanel({ state, actionLabel, onRetry, onRefresh }: Props) {
  const { phase, hash, error, retryable } = state;

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
        {actionLabel}: {PHASE_TEXT[phase]}
      </strong>

      <p>
        <span aria-hidden="true">{PHASE_ICON[phase]}</span>{" "}
        {phase === "pending" || phase === "submitted"
          ? "This can take a while. Validators fetch the sources independently and compare results."
          : phase === "accepted"
            ? "Validators agreed. The result is not permanent until it is final."
            : phase === "finalized"
              ? "This result is permanent."
              : (mapped?.message ?? "Nothing changed on chain.")}
      </p>

      {hash ? (
        <CopyField
          value={hash}
          kind="hash"
          label="Transaction hash"
          explorerUrl={undefined}
        />
      ) : null}

      {phase === "failed" ? (
        <div className="btn-row">
          {retryable && onRetry ? (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              {mapped?.retryLabel ?? "Try again"}
            </button>
          ) : null}
          {onRefresh ? (
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              Refresh status
            </button>
          ) : null}
        </div>
      ) : null}

      {!isTerminal(phase) && onRefresh ? (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            Refresh status
          </button>
        </div>
      ) : null}

      {error ? (
        <details className="disclosure">
          <summary>Details</summary>
          <p className="small muted mono">{error}</p>
        </details>
      ) : null}
    </div>
  );
}