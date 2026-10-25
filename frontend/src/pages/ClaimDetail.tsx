import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { useWallet } from "../hooks/useWallet";
import { refreshTx, runWrite } from "../services/evaluationService";
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
import { getClaimBundle, listPolicies, listSources } from "../services/claimService";
import { activeNetwork } from "../config/network";
import { CONTRACT_ADDRESS, DEPLOYER_ADDRESS } from "../config/contracts";
import type { SourceDef } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Maximum dispute grounds length. Mirrors the contract's
 * `_require_text(grounds, "grounds", 500)` in `open_dispute`
 * (contracts/Climate-Claim.py:232). Value, not behaviour: the contract
 * re-checks it.
 *
 * This was 300, copied from the archived contract's limit. The deployed one
 * allows 500, so the UI was rejecting grounds the chain would have accepted.
 * The mismatch was invisible because a stricter client-side cap never produces a
 * revert -- it just silently truncates what a user may say.
 */
const DISPUTE_GROUNDS_MAX = 500;

/**
 * Writes this screen can send; used to label the shared status panel.
 *
 * Evaluation is two writes, in order: the evaluator fetches the policy's sources
 * inside a leader/validator round and stores the result; the claim then records
 * that stored result after checking it names this policy version and period and
 * agrees with the deterministic engine. Both are permissionless, and neither
 * takes a decision as an argument.
 */
type WriteKind =
  | "evaluate_for_claim"
  | "sync_evaluation"
  | "open_dispute"
  | "finalize_decision"
  | "settle_claim"
  | "confirm_settlement"
  | "fail_settlement";

/** Panel labels match the button that was pressed. */
const WRITE_LABELS: Record<WriteKind, string> = {
  evaluate_for_claim: "Evaluate from sources (consensus round)",
  sync_evaluation: "Record consensus result",
  open_dispute: "Open dispute",
  finalize_decision: "Mark decision final",
  settle_claim: "Emit payout",
  confirm_settlement: "Confirm payout delivered",
  fail_settlement: "Mark payout failed",
};

/** What pressing Evaluate actually does, stated before it is pressed. */
const EVALUATION_NOTE =
  "Evaluation runs on chain from real sources: ClimateEvaluator reads this " +
  "claim's frozen policy, fetches every eligible source inside a leader/validator " +
  "round, and stores the result. ClimateClaim then records it, but only after it " +
  "names this policy version and period and a decisive outcome agrees with the " +
  "policy contract's own arithmetic. Any wallet can run this; no wallet can " +
  "supply the decision.";

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

  // No seed: reads are live-only now. The bundle is several sequential reads
  // (rate-limited), so the page shows a skeleton until they land, and an error
  // state if they do not. Auto-read on mount: without it a direct visit to
  // /claims/<id> reported "Claim not found" before ever asking the chain.
  const bundle = useRead(() => getClaimBundle(id), [id], { autoLive: true });
  const sources = useRead(() => listSources(), [], { autoLive: true });
  const policies = useRead(() => listPolicies(), [], { autoLive: true });

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
   * The two-step evaluation: consensus round on the evaluator, then record it on
   * the claim. The second step is only attempted if the first landed, and the
   * panel reports whichever step is running.
   */
  const runEvaluation = useCallback(async () => {
    setTx(IDLE);
    setLastWrite({ kind: "evaluate_for_claim", args: [id] });
    const evaluated = await runWrite("evaluate_for_claim", [id], { onPhase: setTx });
    if (evaluated.phase !== "accepted" && evaluated.phase !== "finalized") {
      return evaluated;
    }
    setTx(IDLE);
    setLastWrite({ kind: "sync_evaluation", args: [id] });
    const synced = await runWrite("sync_evaluation", [id], { onPhase: setTx });
    if (synced.phase === "accepted" || synced.phase === "finalized") bundle.refresh();
    return synced;
  }, [bundle, id]);

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
    // The contract answers a bad id with "EXPECTED: unknown claim", which arrives
    // as a failed read. That is a missing claim, not a broken page — say so
    // instead of blaming the network, and keep any other failure as a failure.
    const missing = /unknown claim|no claim/i.test(bundle.liveError ?? "");

    if (bundle.origin === "idle") {
      return (
        <div className="stack">
          <h1>{t("claimDetail.h1", { id })}</h1>
          <div className="empty" data-testid="claim-detail-idle">
            <p>{t("origin.idle")}</p>
            <button type="button" className="btn" onClick={bundle.refresh}>
              {t("data.refreshLive")}
            </button>
          </div>
        </div>
      );
    }

    if (bundle.origin === "error" && !missing) {
      return (
        <div className="stack">
          <h1>{t("claimDetail.h1", { id })}</h1>
          <div className="alert alert-warn" data-testid="claim-detail-error">
            <strong>{t("claimDetail.readFailed")}</strong>
            {bundle.liveError ? <p className="small mono">{bundle.liveError}</p> : null}
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={bundle.refresh}
                disabled={bundle.refreshing}
              >
                {t("common.retry")}
              </button>
              <Link className="btn btn-secondary" to="/claims">
                Back to all claims
              </Link>
            </div>
          </div>
        </div>
      );
    }

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

  // The daily series behind the chart comes from a recorded fixture for the same
  // source and period, and is labelled as display detail. Matched by period rather
  // than by claim id, because the recorded replays are not claims on this chain.
  const scenario = DEMO_SCENARIOS.find(
    (sc) => sc.period.start === claim.period_start && sc.period.end === claim.period_end,
  );
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
  const gate = { disabled: tx.phase !== "idle" || wallet.wrongNetwork || !wallet.connected };
  // Evaluation is permissionless and is offered whenever the claim is open for
  // it; a dispute round simply produces the next result.
  const canEvaluate =
    !claim.finalized &&
    ["created", "pending_evaluation", "evidence_collected", "disputed"].includes(claim.state);
  // Finality is permissionless on the deployed contract. It still refuses an
  // inconclusive decision ("EXPECTED: inconclusive decision cannot settle"), so
  // the UI must not offer the button for one.
  const canFinalize =
    decided &&
    !claim.finalized &&
    claim.settlement_state === "not_settled" &&
    claim.decision !== "inconclusive";

  return (
    <div className="stack">
      <header>
        <div className="tag-row" style={{ marginBottom: "var(--space-2)" }}>
          <h1 style={{ margin: 0 }}>Claim {claim.id}</h1>
          <DataModeBadge
            mode={policy.data_mode}
            origin={bundle.origin}
          />
          <OriginBadge
            mode={bundle.origin}
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
                "No consensus evaluation has been recorded for this claim yet. " +
                "Press Evaluate from sources: the evaluator fetches the policy's " +
                "sources and stores threshold, period, location, agreement and " +
                "completeness checks with its result."
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
              <strong>Evidence is fetched and judged by consensus</strong>
              <p>{EVALUATION_NOTE}</p>
            </div>

            {canEvaluate ? (
              <div className="btn-row" style={{ marginBottom: "var(--space-3)" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={gate.disabled}
                  onClick={() => void runEvaluation()}
                >
                  {claim.state === "disputed"
                    ? t("claimDetail.reevaluate")
                    : t("claimDetail.evaluate")}
                </button>
                <span className="small muted">{t("claimDetail.evaluateHelp")}</span>
              </div>
            ) : null}

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
            {claim.state === "disputed" && canEvaluate ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                {t("claimDetail.reevaluateHelp")}
              </p>
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
                  onRefresh={() => {
                    // Re-check the write itself (accepted -> finalized), then
                    // the page's own reads.
                    void refreshTx(tx).then(setTx);
                    bundle.refresh();
                  }}
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
        {policies.origin === "live" ? "policy data read live" : "policy data unavailable"}
      </p>
    </div>
  );
}
