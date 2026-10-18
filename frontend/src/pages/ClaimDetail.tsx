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
import { runWrite } from "../services/evaluationService";
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
import { buildAuditRecord, downloadAuditRecord } from "../domain/auditExport";
import { activeNetwork } from "../config/network";
import { CONTRACT_ADDRESS, DEPLOYER_ADDRESS } from "../config/contracts";
import type { SourceDef } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Maximum dispute grounds length. Mirrors the contract's
 * `self._require_text(grounds, "grounds", 300)` in `open_dispute`
 * (contracts/climateclaim.py). Value, not behaviour: the contract re-checks it.
 */
const DISPUTE_GROUNDS_MAX = 300;

/**
 * Writes this screen can send; used to label the shared status panel.
 *
 * `request_evaluation` is deliberately absent. It no longer exists: on the
 * deployed claim contract, recording a decision is the owner-only
 * `record_evaluation`, which takes the decision as an argument and verifies
 * nothing about it. Offering a visitor a button that claims to "evaluate" the
 * claim would misrepresent what the chain does, so the control is replaced by
 * an explanation (see the actions panel below).
 */
type WriteKind =
  | "open_dispute"
  | "resolve_dispute"
  | "finalize_decision"
  | "settle_claim"
  | "confirm_settlement"
  | "fail_settlement";

/**
 * Panel labels match the button that was pressed, so a dispute is never
 * reported as "Re-evaluate disputed claim" (the file's buttons use these words).
 */
const WRITE_LABELS: Record<WriteKind, string> = {
  open_dispute: "Open dispute",
  resolve_dispute: "Re-evaluate disputed claim",
  finalize_decision: "Mark decision final",
  settle_claim: "Emit payout",
  confirm_settlement: "Confirm payout delivered",
  fail_settlement: "Mark payout failed",
};

/**
 * Why this screen cannot start an evaluation.
 *
 * Stated in the UI rather than left implicit, because a reader who knows the
 * project's design (fetch evidence -> interpret -> consensus) will look for the
 * control and should be told plainly that this deployment does not have it.
 */
const EVALUATION_NOTE =
  "This deployment records decisions, it does not compute them. The claim " +
  "contract has no weather-data access and no model call: `record_evaluation` " +
  "is owner-only and takes the decision, reason, summary and evidence as " +
  "arguments, then stores them unverified. The earlier single-contract design " +
  "fetched the sources and evaluated them on chain; that code is in " +
  "contracts/Climate-Claim-Small.py's predecessor but is not in this deployment, " +
  "so there is no button here to start it.";

/**
 * The main screen. Everything rendered here comes from the deployed contract:
 * the claim, its policy, the evidence, the per-check results, the dispute
 * history and the settlement state.
 */
export function ClaimDetail() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const wallet = useWallet();
  const [tx, setTx] = useState<TxState>(IDLE);
  // The write most recently sent from this screen; the status panel labels its
  // phases with this action and retries THIS write, never a different one.
  const [lastWrite, setLastWrite] = useState<{ kind: WriteKind; args: unknown[] } | null>(null);
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
    async (kind: WriteKind, args: unknown[]) => {
      setTx(IDLE);
      // Remember what was sent: the shared status panel labels phases with this
      // action's name and retries THIS write, never a different one.
      setLastWrite({ kind, args });
      const result = await runWrite(kind, args, { onPhase: setTx });
      // Any write can move the claim (state, round, finalized, settlement), so
      // re-read once it lands rather than leaving stale data on screen.
      if (result.phase === "accepted" || result.phase === "finalized") {
        bundle.refresh();
      }
      return result;
    },
    [bundle],
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
    // Through doWrite so the status panel shows "Open dispute" and retries the
    // dispute rather than some other action; doWrite already refreshes the read.
    const result = await doWrite("open_dispute", [id, text]);
    if (result.phase === "accepted" || result.phase === "finalized") {
      setDisputeOpen(false);
      setGrounds("");
    }
  }, [grounds, id, doWrite]);

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
        <h1>{t("claimDetail.notFound.h")}</h1>
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
  // Emitting the payout is gated on a *finalized* decision; it is not the same
  // as being paid (see canConfirm below).
  const canSettle = claim.finalized && settlement.state === "not_settled" && settlement.amount > 0;
  const isOwner =
    Boolean(wallet.address) &&
    wallet.address!.toLowerCase() === (DEPLOYER_ADDRESS ?? "").toLowerCase();
  // Resolving an emitted payout: delivery is verified out of band (the child
  // transaction's receipt), never inferred from a balance.
  const canConfirm = settlement.state === "payout_emitted" && isOwner;
  const inFlight = settlement.state === "payout_emitted" || settlement.in_flight === true;
  const isClaimant =
    Boolean(wallet.address) && wallet.address!.toLowerCase() === claim.claimant.toLowerCase();
  const gate = { disabled: tx.phase !== "idle" || wallet.wrongNetwork || !wallet.connected };
  // Re-evaluate an open dispute (the contract's resolve_dispute). Either party
  // may do this; the contract re-checks, so the UI only gates on wallet presence.
  const canResolve = claim.state === "disputed" && (isOwner || isClaimant);
  // Mark a decided claim final. Owner only, per the contract's _require_owner.
  const canFinalize = decided && !claim.finalized && isOwner && claim.settlement_state === "not_settled";

  return (
    <div className="stack">
      <header>
        <div className="tag-row" style={{ marginBottom: "var(--space-2)" }}>
          <h1 style={{ margin: 0 }}>Claim {claim.id}</h1>
          <DataModeBadge
            mode={policy.data_mode}
            origin={bundle.origin === "snapshot" ? "recorded" : bundle.origin}
          />
          <OriginBadge
            mode={bundle.origin}
            capturedAt={bundle.capturedAt}
            liveError={bundle.liveError}
            pending={bundle.refreshing}
            networkLabel={net.label}
          onRefresh={bundle.refresh}
          readCost={6}
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
        {/* Print-only receipt header: a printed page has no chrome, so the
            contract and network have to be stated on the paper itself. */}
        <p className="print-only small muted" data-testid="print-note">
          {t("audit.printNote", {
            date: new Date().toISOString().slice(0, 16).replace("T", " "),
            address: CONTRACT_ADDRESS,
            network: net.label,
          })}
        </p>
      </header>

      {wallet.wrongNetwork ? (
        <div className="alert alert-error" role="alert">
          <strong>{t("claimDetail.wrongNetwork")}</strong>
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
              <h2>{t("evidence.chart")}</h2>
              <div className="empty">
                {t("evidence.noSeries")}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>{t("claimDetail.checks")}</h2>
            </div>
            <CheckList
              checks={checks}
              emptyReason={
                // Checks have no on-chain source on this deployment, so the
                // reason is stated rather than dressed up as "not evaluated yet"
                // -- which would imply a future evaluation would fill them in.
                "No per-check results are recorded on this deployment. The " +
                "deployed claim contract stores a decision, a reason code and " +
                "the evidence rows it was given, but it does not produce " +
                "threshold, period, location, agreement or completeness checks."
              }
            />
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <ClaimTimeline claim={claim} disputes={disputes} settlement={settlement.state} />
          </div>

          {/* Actions are controls, not receipt material: the print stylesheet
              drops this panel from the printed record. */}
          <div className="panel" data-print="hide">
            <div className="panel-head">
              <h2>{t("claimDetail.actions")}</h2>
            </div>

            {!hasWallet ? (
              <div className="alert alert-info" style={{ marginBottom: "var(--space-3)" }}>
                <strong>{t("claimDetail.noWallet")}</strong>
                <p>
                  {t("claimDetail.noWalletBody")}
                  on {net.label} (chain {net.chainId}).
                  {net.gasless
                    ? " StudioNet is gasless, so a transaction costs nothing — the expected balance is 0 GEN."
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="alert alert-info" style={{ marginBottom: "var(--space-3)" }} data-testid="evaluation-note">
              <strong>Evaluation is owner-mediated on this deployment</strong>
              <p>{EVALUATION_NOTE}</p>
            </div>

            <div className="btn-row">
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
                Emit payout
              </button>
            </div>

            {/* Finality and dispute-resolution are separate owner/party actions,
                gated exactly as the contract gates them (_require_owner, and
                claimant-or-owner for resolve_dispute). */}
            {canFinalize ? (
              <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={gate.disabled}
                  onClick={() => void doWrite("finalize_decision", [claim.id])}
                >
                  Mark decision final
                </button>
                <span className="small muted">
                  {t("claimDetail.finalizeHelp")}
                </span>
              </div>
            ) : null}
            {canResolve ? (
              <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={gate.disabled}
                  onClick={() => void doWrite("resolve_dispute", [claim.id])}
                >
                  Re-evaluate disputed claim
                </button>
                <span className="small muted">
                  {t("claimDetail.reevaluateHelp")}
                </span>
              </div>
            ) : null}
            {claim.state === "disputed" && claim.pending_grounds ? (
              <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
                <strong>{t("claimDetail.dispute.open")}</strong>
                <p>“{claim.pending_grounds}”</p>
                <p className="small muted">
                  {t("claimDetail.dispute.helpIntro")}
                </p>
              </div>
            ) : null}

            {disputeOpen ? (
              <div className="field" style={{ marginTop: "var(--space-3)" }}>
                <label htmlFor="dispute-grounds">{t("claimDetail.dispute.grounds")}</label>
                <textarea
                  id="dispute-grounds"
                  rows={4}
                  maxLength={DISPUTE_GROUNDS_MAX}
                  value={grounds}
                  placeholder={t("claimDetail.dispute.placeholder")}
                  aria-describedby="dispute-help"
                  aria-invalid={Boolean(groundsError)}
                  onChange={(e) => {
                    setGrounds(e.target.value);
                    if (groundsError) setGroundsError("");
                  }}
                />
                <p className="field-hint" id="dispute-help">
                  {t("claimDetail.dispute.help")}
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
                {t("claimDetail.settle.none")}
              </p>
            ) : null}
            {!canSettle && settlement.amount > 0 && !inFlight ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                {t("claimDetail.settle.gate")}
              </p>
            ) : null}

            {/* A payout message is deducted from the contract immediately but
                reaches the recipient only when its child transaction activates,
                so the UI must show an unverified payout as unverified. */}
            {inFlight ? (
              <div className="alert alert-warn" role="status" style={{ marginTop: "var(--space-3)" }}>
                <strong>{t("claimDetail.settle.emitted")}</strong>
                <p>
                  {t("claimDetail.settle.emittedFull")}
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={gate.disabled || !canConfirm}
                    onClick={() => void doWrite("confirm_settlement", [claim.id])}
                  >
                    Confirm payout delivered
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={gate.disabled || !canConfirm}
                    onClick={() =>
                      void doWrite("fail_settlement", [
                        claim.id,
                        "EXTERNAL: payout child transaction failed",
                      ])
                    }
                  >
                    {t("claimDetail.settle.markFailed")}
                  </button>
                  <span className="small muted">{t("claimDetail.settle.ownerOnly")}</span>
                </div>
              </div>
            ) : null}
            {settlement.state === "settlement_failed" ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                {t("claimDetail.settle.failed")}
              </p>
            ) : null}

            {tx.phase !== "idle" && lastWrite ? (
              <div style={{ marginTop: "var(--space-3)" }}>
                <TxStatusPanel
                  state={tx}
                  actionLabel={WRITE_LABELS[lastWrite.kind]}
                  onRetry={() => void doWrite(lastWrite.kind, lastWrite.args)}
                  onRefresh={bundle.refresh}
                />
              </div>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t("audit.heading")}</h2>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  title={t("audit.exportHint")}
                  onClick={() => {
                    // Same data the page renders, plus provenance: the download
                    // can never contain anything the screen did not show.
                    downloadAuditRecord(
                      buildAuditRecord(value, {
                        origin: bundle.origin,
                        capturedAt: bundle.capturedAt,
                        liveError: bundle.liveError,
                        contractAddress: CONTRACT_ADDRESS,
                        networkLabel: net.label,
                        chainId: net.chainId,
                        sessionTxHash: tx.hash,
                        explorerUrl:
                          tx.hash && net.explorerAvailable
                            ? `${net.explorerUrl}${net.txPath}${tx.hash}`
                            : null,
                      }),
                    );
                  }}
                >
                  {t("audit.export")}
                </button>
                {/* Print receipt: the @media print stylesheet strips the chrome
                    and interactive controls, so this opens the browser's print
                    dialog (save as PDF) over a clean claim record. */}
                <button
                  type="button"
                  className="btn btn-secondary"
                  title={t("audit.printHint")}
                  onClick={() => window.print()}
                >
                  {t("audit.print")}
                </button>
                <Link className="small" to="/how-it-works">
                  How this is decided
                </Link>
              </div>
            </div>
            <AuditPanel claim={claim} policy={policy} txHash={tx.hash} />
          </div>
        </div>
      </div>

      {/* Evidence spans the full width: it is an eight-column table and would be
          unreadable squeezed into the narrow column above. */}
      <div className="panel panel-flush">
        <div className="panel-head" style={{ padding: "var(--space-4) var(--space-4) 0" }}>
          <h2>{t("claimDetail.evidence")}</h2>
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
