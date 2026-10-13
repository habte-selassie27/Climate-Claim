import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { useWallet } from "../hooks/useWallet";
import {
  getClaimBundle,
  listPolicies,
  listSources,
  snapshotClaimBundle,
  snapshotPolicies,
  snapshotSources,
} from "../services/claimService";
import { runWrite, walletAvailable } from "../services/evaluationService";
import { IDLE, type TxState } from "../services/txStatus";
import { AuditPanel } from "../components/AuditPanel";
import { CheckList } from "../components/CheckList";
import { ClaimTimeline } from "../components/ClaimTimeline";
import { DataModeBadge, DataModePanel } from "../components/DataModeBadge";
import { DecisionPanel } from "../components/DecisionPanel";
import { EvidenceChart } from "../components/EvidenceChart";
import { EvidenceTable } from "../components/EvidenceTable";
import { OriginBadge } from "../components/OriginBadge";
import { TxStatusPanel } from "../components/TxStatusPanel";
import { DEMO_SCENARIOS } from "../fixtures/demoScenarios";
import { policySentence } from "../domain/copy";
import { activeNetwork } from "../config/network";
import type { SourceDef } from "../domain/types";

const net = activeNetwork();

/**
 * Maximum dispute grounds length. Mirrors the contract's
 * `self._require_text(grounds, "grounds", 300)` in `open_dispute`
 * (contracts/climateclaim.py). Value, not behaviour: the contract re-checks it.
 */
const DISPUTE_GROUNDS_MAX = 300;

/**
 * The main screen. Everything rendered here comes from the deployed contract:
 * the claim, its policy, the evidence, the per-check results, the dispute
 * history and the settlement state.
 */
export function ClaimDetail() {
  const { id = "" } = useParams();
  const wallet = useWallet();
  const [tx, setTx] = useState<TxState>(IDLE);
  // Dispute grounds. The contract requires non-empty grounds (max 300 chars) and
  // records them in the dispute history, so the user must supply their own
  // reason rather than the app sending a fixed string.
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [grounds, setGrounds] = useState("");
  const [groundsError, setGroundsError] = useState("");

  // Seeded from the captured snapshot: paints real recorded data immediately,
  // then transparently upgrades to live chain reads (which are rate limited to
  // 30 requests/minute, so several reads legitimately take seconds).
  const bundle = useRead(() => getClaimBundle(id), [id], snapshotClaimBundle(id));
  const sources = useRead(() => listSources(), [], snapshotSources());
  const policies = useRead(() => listPolicies(), [], snapshotPolicies());

  // The daily series behind the chart comes from the recorded fixture for the
  // same source and period, and is labelled as display detail.
  const scenario = DEMO_SCENARIOS.find((s) => s.onChainClaimId === id);

  const doWrite = useCallback(
    async (kind: "request_evaluation" | "open_dispute" | "settle_claim", args: unknown[]) => {
      setTx(IDLE);
      await runWrite(kind, args, { onPhase: setTx });
    },
    [],
  );

  /**
   * Submit a dispute with the user's own grounds.
   *
   * Mirrors the contract's `open_dispute` validation: grounds must be non-empty
   * and at most MAX_DISPUTE_GROUNDS (300) characters, else it reverts with
   * "EXPECTED: grounds required". Validating here avoids a transaction that is
   * guaranteed to fail; the contract remains the authority.
   */
  const submitDispute = useCallback(async () => {
    const text = grounds.trim();
    if (!text) {
      setGroundsError("Give a reason for the dispute — the contract requires one.");
      return;
    }
    if (text.length > DISPUTE_GROUNDS_MAX) {
      setGroundsError(
        `Keep the grounds to ${DISPUTE_GROUNDS_MAX} characters or fewer (currently ${text.length}).`,
      );
      return;
    }
    setGroundsError("");
    const result = await runWrite("open_dispute", [id, text], { onPhase: setTx });
    if (result.phase === "accepted" || result.phase === "finalized") {
      setDisputeOpen(false);
      setGrounds("");
      bundle.refresh();
    }
  }, [grounds, id]);

  if (bundle.loading) {
    return (
      <div className="stack" aria-busy="true">
        <div className="skeleton" style={{ width: "40%", height: 28 }} />
        <div className="panel">
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "55%", marginTop: 12 }} />
          <div className="skeleton" style={{ width: "60%", marginTop: 12 }} />
        </div>
        <div className="panel">
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  const value = bundle.data;

  if (!value) {
    return (
      <div className="stack">
        <h1>Claim not found</h1>
        <div className="alert alert-warn">
          <strong>No claim called “{id}”</strong>
          <p>
            It may not exist yet, or the network could not be reached.{" "}
            {bundle.liveError ? <span className="mono">{bundle.liveError}</span> : null}
          </p>
          <Link className="btn btn-secondary" to="/claims">
            Back to all claims
          </Link>
        </div>
      </div>
    );
  }

  const { claim, policy, evidence, checks, disputes, settlement } = value;
  const hasWallet = typeof window !== "undefined" && "ethereum" in window;
  const decided = Boolean(claim.decision);
  const canSettle = claim.finalized && settlement.state === "not_settled" && settlement.amount > 0;

  return (
    <div className="stack">
      <header>
        <div className="tag-row" style={{ marginBottom: "var(--space-2)" }}>
          <h1 style={{ margin: 0 }}>Claim {claim.id}</h1>
          <DataModeBadge mode={policy.data_mode} origin={bundle.origin === "snapshot" ? "recorded" : "live"} />
          <OriginBadge
            mode={bundle.origin}
            capturedAt={bundle.capturedAt}
            liveError={bundle.liveError}
            pending={bundle.refreshing}
            networkLabel={net.label}
          />
        </div>
        <p className="lede" data-testid="policy-sentence">
          {policySentence({
            location_name: policy.location_name,
            comparator: policy.comparator,
            threshold_scaled: policy.threshold_scaled,
            unit: policy.unit,
            aggregation: policy.aggregation,
            period_start: policy.period_start,
            period_end: policy.period_end,
            source_ids: policy.source_ids,
          })}
        </p>
        <DataModePanel mode={policy.data_mode} />
      </header>

      {wallet.wrongNetwork ? (
        <div className="alert alert-error" role="alert">
          <strong>Wrong network</strong>
          <p>
            Your wallet is on chain {wallet.chainId}. This app reads {net.label} (chain{" "}
            {net.chainId}). Reading still works; switch networks to send a transaction.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => void wallet.switchNetwork()}
              disabled={wallet.switching}
            >
              {wallet.switching ? "Switching…" : `Switch to ${net.label}`}
            </button>
          </div>
          {wallet.error ? (
            <p className="small muted" style={{ marginTop: "var(--space-2)" }}>
              {wallet.error} You can also switch manually in your wallet extension.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="claim-grid">
        <div className="stack">
          <div className="panel">
            <DecisionPanel claim={claim} policy={policy} txPhase={tx.phase} evalError={claim.eval_error} />
          </div>

          {scenario ? (
            <div className="panel">
              <EvidenceChart
                series={scenario.series}
                period={scenario.period}
                thresholdScaled={policy.threshold_scaled}
                comparator={policy.comparator}
                unit={policy.unit}
                caption="Daily readings come from the recorded source response for this location and period (see fixtures/historical/). The contract stores the aggregated value and the crossing flag; the daily detail is display-only."
              />
            </div>
          ) : (
            <div className="panel">
              <h2>Evidence chart</h2>
              <div className="empty">
                No recorded daily series backs this claim yet. The aggregated evidence the contract
                evaluated is in the evidence table below.
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>Checks</h2>
            </div>
            <CheckList
              checks={checks}
              emptyReason={
                claim.eval_error
                  ? "The evaluation did not complete, so no checks were recorded. The reason is shown in the decision panel."
                  : "This claim has not been evaluated yet."
              }
            />
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <ClaimTimeline claim={claim} disputes={disputes} settlement={settlement.state} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Actions</h2>
            </div>

            {!hasWallet ? (
              <div className="alert alert-info" style={{ marginBottom: "var(--space-3)" }}>
                <strong>No wallet detected</strong>
                <p>
                  Reading claims is open to everyone. Sending a transaction needs a browser wallet
                  on {net.label} (chain {net.chainId}).
                  {net.gasless
                    ? " StudioNet is gasless, so a transaction costs nothing — the expected balance is 0 GEN."
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="btn-row">
              <button
                type="button"
                className="btn"
                disabled={tx.phase !== "idle" || wallet.wrongNetwork || !wallet.connected}
                onClick={() => void doWrite("request_evaluation", [claim.id])}
              >
                Request evaluation
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                /* Only *submitting* needs a wallet. Opening the form to read the
                   rules and write grounds does not, so it stays available and
                   the submit button carries the wallet gate instead. */
                disabled={tx.phase !== "idle" || !decided}
                onClick={() => setDisputeOpen((v) => !v)}
                aria-expanded={disputeOpen}
              >
                {disputeOpen ? "Close dispute form" : "Open dispute"}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={tx.phase !== "idle" || !canSettle || wallet.wrongNetwork || !wallet.connected}
                onClick={() => void doWrite("settle_claim", [claim.id])}
              >
                Settle claim
              </button>
            </div>

            {disputeOpen ? (
              <div className="field" style={{ marginTop: "var(--space-3)" }}>
                <label htmlFor="dispute-grounds">Grounds for the dispute</label>
                <textarea
                  id="dispute-grounds"
                  rows={4}
                  maxLength={DISPUTE_GROUNDS_MAX}
                  value={grounds}
                  placeholder="Why should this decision be challenged? Name the source, station or observation period you believe the validators judged incorrectly."
                  aria-describedby="dispute-help"
                  aria-invalid={Boolean(groundsError)}
                  onChange={(e) => {
                    setGrounds(e.target.value);
                    if (groundsError) setGroundsError("");
                  }}
                />
                <p className="field-hint" id="dispute-help">
                  The contract stores this text with the dispute and requires it to be non-empty, at
                  most {DISPUTE_GROUNDS_MAX} characters. It is shown in the dispute history.
                </p>
                {groundsError ? (
                  <p className="field-error" role="alert">
                    {groundsError}
                  </p>
                ) : null}
                <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={tx.phase !== "idle" || wallet.wrongNetwork || !wallet.connected}
                    onClick={() => void submitDispute()}
                  >
                    Submit dispute
                  </button>
                  {!wallet.connected ? (
                    <span className="small muted">
                      Connect a wallet on {net.label} to submit.
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setDisputeOpen(false);
                      setGrounds("");
                      setGroundsError("");
                    }}
                  >
                    Cancel
                  </button>
                  <span className="small muted num">
                    {grounds.trim().length}/{DISPUTE_GROUNDS_MAX}
                  </span>
                </div>
              </div>
            ) : null}

            {!canSettle && settlement.amount === 0 ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                This policy has no payout amount, so there is nothing to settle.
              </p>
            ) : null}
            {!canSettle && settlement.amount > 0 ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                Settlement is only enabled once the decision is final. An accepted decision can
                still be appealed.
              </p>
            ) : null}

            {tx.phase !== "idle" ? (
              <div style={{ marginTop: "var(--space-3)" }}>
                <TxStatusPanel
                  state={tx}
                  actionLabel="Request evaluation"
                  onRetry={() => void doWrite("request_evaluation", [claim.id])}
                  onRefresh={bundle.refresh}
                />
              </div>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Audit</h2>
              <Link className="small" to="/how-it-works">
                How this is decided
              </Link>
            </div>
            <AuditPanel claim={claim} policy={policy} txHash={tx.hash} />
          </div>
        </div>
      </div>

      {/* Evidence spans the full width: it is an eight-column table and would be
          unreadable squeezed into the narrow column above. */}
      <div className="panel panel-flush">
        <div className="panel-head" style={{ padding: "var(--space-4) var(--space-4) 0" }}>
          <h2>Evidence</h2>
          <span className="badge">read from the contract</span>
        </div>
        <EvidenceTable evidence={evidence} sources={(sources.data ?? []) as SourceDef[]} />
      </div>

      <p className="small muted">
        Policy <Link to={`/policies/${policy.id}`}>{policy.id}</Link> ·{" "}
        {policies.origin === "snapshot" ? "policy data from recorded snapshot" : "policy data read live"}
      </p>
    </div>
  );
}

export { walletAvailable };