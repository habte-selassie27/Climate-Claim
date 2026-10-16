import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DEMO_SCENARIOS, type DemoScenario } from "../fixtures/demoScenarios";
import { useRead } from "../hooks/useRead";
import { getClaimBundle, snapshotClaimBundle } from "../services/claimService";
import { CheckList } from "../components/CheckList";
import { DataModeBadge } from "../components/DataModeBadge";
import { DecisionPanel } from "../components/DecisionPanel";
import { DeterministicContrast } from "../components/DeterministicContrast";
import { EvidenceChart } from "../components/EvidenceChart";
import { OriginBadge } from "../components/OriginBadge";
import { SourceComparison } from "../components/SourceComparison";
import { mapError, policySentence } from "../domain/copy";
import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import type { Claim, Policy } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Demo mode (UI.md section 8).
 *
 * Honest labelling is the whole point of this page:
 *  - a scenario marked "on-chain" links to a real transaction on the deployed
 *    contract, and its decision, checks and evidence are read from the chain;
 *  - a scenario marked "replay" shows recorded source data with an outcome
 *    derived by running the contract's own evaluation rules, and is never
 *    presented as a transaction.
 */
export function Demo() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("scenario");
  const scenario = useMemo(() => {
    if (requested) {
      const match = DEMO_SCENARIOS.find((s) => s.id === requested);
      if (match) return match;
    }
    return DEMO_SCENARIOS[0];
  }, [requested]);

  const isOnChain = scenario.provenance === "on_chain" && Boolean(scenario.onChainClaimId);

  /**
   * For an on-chain scenario the decision, checks and evidence are read from the
   * deployed contract, not reconstructed locally. A replay scenario has no
   * chain claim, so its outcome comes from the scenario definition and is
   * labelled as such.
   */
  const bundle = useRead(
    () => (isOnChain && scenario.onChainClaimId ? getClaimBundle(scenario.onChainClaimId) : Promise.resolve({ data: undefined, origin: "snapshot" as const })),
    [scenario.id],
    isOnChain && scenario.onChainClaimId ? snapshotClaimBundle(scenario.onChainClaimId) : undefined,
  );

  const real = isOnChain ? bundle.data : undefined;

  return (
    <div className="stack">
      <header>
        <h1>{t("demo.h1")}</h1>
        <p className="lede">
          {t("demo.lede")}
        </p>
      </header>

      <div className="claim-grid">
        <div className="stack">
          <section aria-labelledby="scenario-title">
            <div className="panel-head">
              <h2 id="scenario-title">{scenario.title}</h2>
              <span
                className={`provenance ${isOnChain ? "provenance-live" : "provenance-replay"}`}
                data-testid="provenance-badge"
              >
                {isOnChain ? "real on-chain claim" : "replay of recorded data"}
              </span>
            </div>

            <p className="small muted" data-testid="scenario-tests">
              <strong>{t("demo.whatItTests")}</strong> {scenario.whatThisTests}
            </p>

            <div className="tag-row" style={{ marginBottom: "var(--space-3)" }}>
              <DataModeBadge mode={scenario.policy.data_mode} />
              {isOnChain && real ? (
                <>
                  <OriginBadge
                    mode={bundle.origin}
                    capturedAt={bundle.capturedAt}
                    liveError={bundle.liveError}
                    pending={bundle.refreshing}
                    networkLabel={net.label}
                  />
                  <Link className="badge" to={`/claims/${scenario.onChainClaimId}`}>
                    Open {scenario.onChainClaimId} on the network
                  </Link>
                </>
              ) : (
                <span className="badge badge-origin">no transaction — replay only</span>
              )}
            </div>

            <p className="small" data-testid="scenario-policy">
              {policySentence({
                location_name: scenario.locationName,
                comparator: scenario.policy.comparator,
                threshold_scaled: scenario.policy.threshold_scaled,
                unit: scenario.policy.unit,
                aggregation: scenario.policy.aggregation,
                period_start: scenario.period.start,
                period_end: scenario.period.end,
                source_ids: scenario.policy.source_ids,
              })}
            </p>

            {scenario.notes ? (
              <div className="alert alert-info">
                <p className="small" style={{ margin: 0 }}>
                  {scenario.notes}
                </p>
              </div>
            ) : null}

            {scenario.contractError ? (
              <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
                <strong>{t("demo.rejected")}</strong>
                <p>{mapError(scenario.contractError).message}</p>
                <p className="small muted">
                  The contract returns the stable string{" "}
                  <code>{scenario.contractError}</code> and no claim is created.
                </p>
              </div>
            ) : null}
          </section>

          <div className="panel">
            <EvidenceChart
              series={scenario.series}
              period={scenario.period}
              thresholdScaled={scenario.policy.threshold_scaled}
              comparator={scenario.policy.comparator}
              unit={scenario.policy.unit}
              caption="Readings are the recorded response from the documented endpoint for this location and period. Missing days are drawn as hatched gaps and are never estimated."
            />
          </div>

          {/* Item 8: with two or more sources, the per-day comparison table
              sits directly beside the chart. It draws the same recorded series
              and names the disagreement days explicitly. */}
          {scenario.series.length >= 2 ? (
            <div className="panel">
              <SourceComparison
                series={scenario.series}
                period={scenario.period}
                thresholdScaled={scenario.policy.threshold_scaled}
                comparator={scenario.policy.comparator}
                unit={scenario.policy.unit}
              />
            </div>
          ) : null}

          {/* Item 9: when the recorded answer is inconclusive because the
              sources genuinely split, show what a deterministic chain would
              have had to say. Renders nothing for scenarios without a split. */}
          <DeterministicContrast scenario={scenario} />

          <div className="panel">
            <div className="panel-head">
              <h3>{t("demo.decision")}</h3>
              {isOnChain && real ? (
                <span className="badge badge-live">
                  <span aria-hidden="true">◉</span> {t("demo.badgeLive", { id: real.claim.id })}
                </span>
              ) : (
                <span className="badge badge-origin">{t("demo.badgeReplay")}</span>
              )}
            </div>

            {scenario.contractError ? (
              <div className="empty" data-testid="scenario-no-decision">
                {t("demo.rejectedBody")}
              </div>
            ) : (
              <DecisionPanel
                claim={real ? real.claim : buildReplayClaim(scenario)}
                policy={real ? real.policy : buildReplayPolicy(scenario)}
                txPhase="idle"
              />
            )}

            {real && real.checks.length > 0 ? (
              <div style={{ marginTop: "var(--space-4)" }}>
                <div className="panel-head">
                  <h4>{t("demo.checks")}</h4>
                  <span className="badge">{real.checks.length} checks</span>
                </div>
                <CheckList checks={real.checks} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h3>{t("demo.scenarios")}</h3>
            </div>
            <ul className="scenario-list">
              {DEMO_SCENARIOS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="scenario-btn"
                    aria-current={s.id === scenario.id}
                    onClick={() =>
                      setSearchParams((prev) => {
                        // Keep every other parameter (notably ?lang=) so a
                        // shared URL reproduces the scenario AND the language
                        // it was read in.
                        const next = new URLSearchParams(prev);
                        next.set("scenario", s.id);
                        return next;
                      })
                    }
                  >
                    <span className="scenario-title">
                      {s.title}
                      {s.provenance === "on_chain" ? (
                        <span className="provenance provenance-live">on-chain</span>
                      ) : (
                        <span className="provenance provenance-replay">replay</span>
                      )}
                    </span>
                    <p className="scenario-tests">{s.whatThisTests}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>{t("demo.howToRead")}</h3>
            </div>
            <p className="small">
              <span className="provenance provenance-live">
                {t("demo.provenance.onChain")}
              </span>{" "}
              {t("demo.provenance.onChainBody", { address: CONTRACT_ADDRESS })}
            </p>
            <p className="small">
              <span className="provenance provenance-replay">
                {t("demo.provenance.replay")}
              </span>{" "}
              {t("demo.provenance.replayBody")}
            </p>
            <p className="small muted">
              {t("demo.pinnedBy")} {" "}
              <span className="mono" style={{ overflowWrap: "anywhere" }}>
                {scenario.verifyingTest}
              </span>
            </p>
          </div>

          <div className="panel">
            <h3>{t("demo.whereNumbers")}</h3>
            <p className="small muted">
              {t("demo.fixtures")}
            </p>
            <p className="small muted">
              {t("demo.network", { network: net.label, id: net.chainId })} {" "}
              {net.explorerAvailable
                ? t("demo.explorerLive")
                : "The StudioNet explorer is currently paused, so transaction links are shown disabled rather than as dead links."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A replay scenario has no on-chain claim, so the decision panel is fed a
 * locally-assembled Claim/Policy pair derived from the scenario definition.
 * It is never presented as chain data.
 */
function buildReplayClaim(scenario: DemoScenario): Claim {
  return {
    id: "(replay)",
    policy_id: "(replay)",
    claimant: "",
    state:
      scenario.expected.decision === "confirmed"
        ? "decided_confirmed"
        : scenario.expected.decision === "not_confirmed"
          ? "decided_not_confirmed"
          : "inconclusive",
    decision: scenario.expected.decision,
    reason_code: scenario.expected.reason_code,
    observed_value_scaled: scenario.expected.observed_value_scaled,
    // A replay has no validator, so it must not borrow the "In the validator's
    // words" framing. The plain-language reason above carries the meaning.
    summary: "",
    criteria_version: "climateclaim-criteria-1",
    eval_round: scenario.id === "dispute-round" ? 1 : 0,
    finalized: false,
    settlement_state: "not_settled",
    eval_error: "",
  };
}

function buildReplayPolicy(scenario: DemoScenario): Policy {
  return {
    id: "(replay)",
    owner: "",
    beneficiary: "",
    location_name: scenario.locationName,
    lat_scaled: 0,
    lon_scaled: 0,
    tolerance_m: scenario.policy.tolerance_m,
    source_ids: scenario.policy.source_ids,
    agreement_rule: scenario.policy.agreement_rule,
    min_sources: scenario.policy.min_sources,
    data_mode: scenario.policy.data_mode,
    period_start: scenario.period.start,
    period_end: scenario.period.end,
    timezone: scenario.period.timezone,
    metric: "precipitation",
    unit: scenario.policy.unit,
    comparator: scenario.policy.comparator as Policy["comparator"],
    threshold_scaled: scenario.policy.threshold_scaled,
    aggregation: scenario.policy.aggregation as Policy["aggregation"],
    condition_text: scenario.policy.condition_text,
    payout_amount: 0,
    status: "active",
    claim_count: 0,
  };
}

export type { DemoScenario };
