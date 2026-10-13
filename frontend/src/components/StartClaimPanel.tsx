import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { findClaim } from "../services/claimService";
import { runWrite } from "../services/evaluationService";
import { IDLE, type TxState } from "../services/txStatus";
import { TxStatusPanel } from "./TxStatusPanel";
import { activeNetwork } from "../config/network";
import type { Policy } from "../domain/types";

const net = activeNetwork();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  policy: Policy;
  /** Refresh the claims list after a successful write. */
  onChanged: () => void;
}

/**
 * Start a claim on a policy.
 *
 * The contract's `start_claim(policy_id, period_start, period_end)` requires
 * the period to fall inside the policy's own window and rejects a duplicate
 * (policy, period) pair with "EXPECTED: duplicate claim". Both rules are
 * mirrored here so the user is told before a transaction is sent; the
 * `find_claim` view performs the duplicate pre-check against live state.
 */
export function StartClaimPanel({ policy, onChanged }: Props) {
  const wallet = useWallet();
  const navigate = useNavigate();
  const [periodStart, setPeriodStart] = useState(policy.period_start);
  const [periodEnd, setPeriodEnd] = useState(policy.period_end);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>(IDLE);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const retired = policy.status !== "active";
  const busy = tx.phase === "submitted" || tx.phase === "pending";

  const validate = (): string => {
    if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
      return "Both dates must be valid calendar dates (YYYY-MM-DD).";
    }
    if (periodStart > periodEnd) return "The start date is after the end date.";
    if (periodStart < policy.period_start || periodEnd > policy.period_end) {
      return `A claim's period must fall inside the policy window (${policy.period_start} to ${policy.period_end}).`;
    }
    return "";
  };

  const submit = async () => {
    const problem = validate();
    setError(problem);
    setExisting(null);
    if (problem) return;

    // Duplicate pre-check against live chain state (the contract enforces the
    // same rule; this only avoids sending a write that must fail).
    try {
      const found = await findClaim(policy.id, periodStart, periodEnd);
      if (found.origin === "live" && found.data) {
        setExisting(found.data);
        return;
      }
    } catch {
      // Pre-check is best effort; the contract remains the authority.
    }

    const result = await runWrite("start_claim", [policy.id, periodStart, periodEnd], {
      onPhase: setTx,
    });
    if (result.phase === "accepted" || result.phase === "finalized") {
      // Resolve the new claim's id from live state rather than guessing it.
      try {
        const found = await findClaim(policy.id, periodStart, periodEnd);
        if (found.origin === "live" && found.data) setCreatedId(found.data);
      } catch {
        // Fall through to the generic message below.
      }
      onChanged();
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Start a claim</h2>
      </div>

      {retired ? (
        <p className="small muted">
          This policy is retired, so no new claims can be started on it.
        </p>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="claim-period-start">Claim period start</label>
          <input
            id="claim-period-start"
            type="date"
            min={policy.period_start}
            max={policy.period_end}
            value={periodStart}
            disabled={retired}
            onChange={(e) => setPeriodStart(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-period-end">Claim period end</label>
          <input
            id="claim-period-end"
            type="date"
            min={policy.period_start}
            max={policy.period_end}
            value={periodEnd}
            disabled={retired}
            onChange={(e) => setPeriodEnd(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {existing ? (
        <div className="alert alert-info" role="status">
          <strong>A claim for this period already exists</strong>
          <p>
            The contract keeps one claim per (policy, period).{" "}
            <Link to={`/claims/${existing}`}>Open {existing}</Link>, or choose a different period.
          </p>
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
        <button
          type="button"
          className="btn"
          disabled={retired || busy || wallet.wrongNetwork || !wallet.connected}
          onClick={() => void submit()}
        >
          Start a claim
        </button>
      </div>

      {!wallet.connected && !retired ? (
        <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
          {wallet.available
            ? "Connect your wallet to send this transaction."
            : "No browser wallet was detected. Reading works; starting a claim needs a wallet."}
          {net.gasless ? ` ${net.label} is gasless, so a transaction costs nothing.` : ""}
        </p>
      ) : null}

      {tx.phase !== "idle" ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <TxStatusPanel
            state={tx}
            actionLabel="Start a claim"
            onRetry={() => void submit()}
            onRefresh={onChanged}
          />
          {createdId ? (
            <p style={{ marginTop: "var(--space-3)" }}>
              <button
                type="button"
                className="btn"
                onClick={() => navigate(`/claims/${createdId}`)}
              >
                Open {createdId}
              </button>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
