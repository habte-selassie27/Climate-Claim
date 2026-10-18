import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DEMO_SCENARIOS, type DemoScenario } from "../fixtures/demoScenarios";
import { useRead } from "../hooks/useRead";
import { getClaimBundle, listClaims, computeEvaluation, type EngineResult } from "../services/claimService";
import { CheckList } from "../components/CheckList";
import { EvidenceTable } from "../components/EvidenceTable";
import { OriginBadge } from "../components/OriginBadge";
import { mapError } from "../domain/copy";
import { CONTRACT_ADDRESS, POLICY_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import type { CheckName, CheckStatus, Claim } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Demo.
 *
 * Two clearly separated things, never mixed:
 *
 * 1. LIVE CLAIMS. Read from the deployed ClimateClaim contract. Every claim that
 *    exists on this deployment is listed and selectable, with a Create Claim
 *    action when there are none. Nothing here is hardcoded — the list comes from
 *    `list_claims` and an empty chain shows an empty state.
 *
 *    The previous version of this page defaulted to a hardcoded `claim-2` from a
 *    contract that is no longer deployed. That link asserted this deployment held
 *    a claim it never did.
 *
 * 2. RECORDED REPLAYS. Each scenario replays a real recorded response from a
 *    documented endpoint through the DEPLOYED policy contract's own
 *    `compute_evaluation`, so the outcome shown is what this contract decides
 *    about that evidence — not a stored answer and not a transaction. This is a
 *    replay and is labelled as one throughout.
 */
export function Demo() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const selectedClaim = params.get("claim") ?? "";
  const scenarioId = params.get("scenario") ?? "";
  // Read on mount: this page exists to show live claims and to run recorded
  // replays through the deployed engine, so an unread page would show nothing
  // but an empty state that looks like an empty chain.
  const claims = useRead(() => listClaims(), [], { autoLive: true });
  const rows = (claims.data ?? []) as Claim[];

  const active: Claim | undefined =
    rows.find((c) => c.id === selectedClaim) ?? rows[0] ?? undefined;
  const detail = useRead(
    () => (active ? getClaimBundle(active.id) : Promise.resolve({ data: undefined, origin: "error" as const })),
    [active?.id ?? ""],
    { autoLive: true },
  );

  const scenario = useMemo(
    () => DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0],
    [scenarioId],
  );

  const setClaim = (id: string) => setParams({ claim: id }, { replace: true });
  const setScenario = (id: string) => setParams({ scenario: id }, { replace: true });

  return (
    <div className="stack">
      <header>
        <h1>{t("nav.demo")}</h1>
        <p className="lede">
          Live claims read from <span className="mono">{CONTRACT_ADDRESS}</span> on {net.label}, and
          recorded replays run through the decision engine on{" "}
          <span className="mono">{POLICY_ADDRESS}</span>.
        </p>
        <OriginBadge
          mode={claims.origin}
          liveError={claims.liveError}
          pending={claims.loading || claims.refreshing}
          networkLabel={net.label}
          onRefresh={claims.refresh}
          readCost={1}
        />
      </header>

      {/* --- 1. live claims ------------------------------------------------- */}
      <section className="panel" data-testid="demo-live-claims">
        <div className="panel-head">
          <h2>Claims on {net.label}</h2>
        </div>

        {claims.loading ? (
          <div className="skeleton" style={{ height: 64 }} />
        ) : claims.origin === "idle" ? (
          <div className="empty" data-testid="demo-claims-idle">
            <p>{t("claims.notRead")}</p>
          </div>
        ) : claims.origin === "error" ? (
          <div className="empty" data-testid="demo-claims-error">
            <p>{t("claims.cantRead")}</p>
            {claims.liveError ? (
              <p className="small mono">{t("origin.unreachable", { error: claims.liveError })}</p>
            ) : null}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty" data-testid="demo-no-claims">
            <p>{t("claims.empty")}</p>
            <p className="small">
              This deployment has no claims yet.{" "}
              <Link to="/claims/new">Create claim</Link> to open one against a policy.
            </p>
          </div>
        ) : (
          <>
            <div className="filter-grid" style={{ marginBottom: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="demo-claim">Claim</label>
                <select
                  id="demo-claim"
                  value={active?.id ?? ""}
                  onChange={(e) => setClaim(e.target.value)}
                >
                  {rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.policy_id} — {c.decision || "not evaluated"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {detail.data ? (
              <div className="stack">
                <p className="small">
                  <Link to={`/claims/${detail.data.claim.id}`}>
                    Open {detail.data.claim.id} in full
                  </Link>
                </p>
                <div className="stack">
                  <div className="tag-row">
                    <span className="mono">{detail.data.claim.id}</span>
                    <span className="finality-chip finality-accepted">
                      {detail.data.claim.state}
                    </span>
                    <span className="finality-chip">
                      {detail.data.claim.decision || "not evaluated"}
                    </span>
                  </div>
                  {detail.data.claim.summary ? (
                    <p className="lede">{detail.data.claim.summary}</p>
                  ) : null}
                  <CheckList checks={detail.data.checks} />
                  <EvidenceTable evidence={detail.data.evidence} sources={[]} />
                </div>
              </div>
            ) : (
              <p className="small muted">Loading claim detail…</p>
            )}
          </>
        )}
      </section>

      {/* --- 2. recorded replays -------------------------------------------- */}
      <section className="panel" data-testid="demo-replays">
        <div className="panel-head">
          <h2>Recorded replays</h2>
          <span className="badge badge-sim">Not transactions</span>
        </div>
        <p className="small muted">
          Real recorded responses from a documented endpoint, replayed through the deployed policy
          contract&rsquo;s own <span className="mono">compute_evaluation</span>. The outcome below is
          what this contract decides about that evidence — nothing here is a claim, a decision that
          was stored, or a transaction.
        </p>

        <div className="filter-grid" style={{ marginBottom: "var(--space-3)" }}>
          <div className="field">
            <label htmlFor="demo-scenario">Scenario</label>
            <select
              id="demo-scenario"
              value={scenario.id}
              onChange={(e) => setScenario(e.target.value)}
            >
              {DEMO_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="small">{scenario.whatThisTests}</p>
        <ReplayOutcome scenario={scenario} />
      </section>
    </div>
  );
}

/**
 * Run one recorded scenario through the deployed engine.
 *
 * The scenario holds a daily series; the engine wants one row per source, so the
 * daily values are reduced here the same way the policy's aggregation says. The
 * engine then recomputes the crossing and the decision itself — this component
 * never decides the outcome, it only supplies the evidence.
 */
function ReplayOutcome({ scenario }: { scenario: DemoScenario }) {
  const { t } = useI18n();
  const days = useMemo(() => {
    const keys = Object.keys(scenario.series[0]?.daily ?? {}).sort();
    return Math.max(1, keys.length);
  }, [scenario]);

  const rows = useMemo(
    () =>
      scenario.series.map((s) => {
        const values = Object.values(s.daily).filter((v): v is number => typeof v === "number");
        const agg =
          scenario.policy.aggregation === "cumulative"
            ? values.reduce((a, b) => a + b, 0)
            : Math.max(...values, 0);
        return {
          source_id: s.sourceId,
          ok: values.length > 0,
          days_covered: values.length,
          value_scaled: Math.round(agg * 100),
        };
      }),
    [scenario],
  );

  const policyJson = useMemo(
    () =>
      JSON.stringify({
        id: "replay",
        comparator: scenario.policy.comparator,
        threshold_scaled: scenario.policy.threshold_scaled,
        aggregation: scenario.policy.aggregation,
        agreement_rule: scenario.policy.agreement_rule,
        min_sources: scenario.policy.min_sources,
        source_ids: scenario.policy.source_ids,
      }),
    [scenario],
  );

  // The replay is the point of this section, and it is a read against the
  // deployed engine, so it runs on mount instead of waiting to be asked.
  const engine = useRead(() => computeEvaluation(policyJson, rows, days), [policyJson], {
    autoLive: true,
  });

  if (engine.loading) return <div className="skeleton" style={{ height: 90 }} />;
  if (engine.origin === "idle") {
    return (
      <div className="empty" data-testid="replay-idle">
        <p>{t("demo.replayNotRun")}</p>
      </div>
    );
  }
  if (engine.origin === "error" || !engine.data) {
    return (
      <div className="empty" data-testid="replay-error">
        <p>{t("demo.replayFailed")}</p>
        {engine.liveError ? (
          <p className="small mono">{t("origin.unreachable", { error: mapError(engine.liveError).message })}</p>
        ) : null}
      </div>
    );
  }

  return <EngineOutcome result={engine.data} />;
}

function EngineOutcome({ result }: { result: EngineResult }) {
  const tone =
    result.decision === "confirmed"
      ? "finality-final"
      : result.decision === "not_confirmed"
        ? "finality-pending"
        : "finality-accepted";
  return (
    <div className="stack" data-testid="replay-outcome">
      <div className="tag-row">
        <span className={`finality-chip ${tone}`}>{result.decision}</span>
        <span className="badge">{result.reason_code}</span>
        <span className="badge">observed {result.observed_value_scaled / 100}</span>
        <span className="badge">criteria {result.criteria_version}</span>
      </div>
      <p className="small muted">
        Derived on chain by <span className="mono">compute_evaluation</span> from{" "}
        {result.sources_used.length} source row(s)
        {result.sources_missing.length
          ? `, ${result.sources_missing.length} missing`
          : ""}
        . The engine recomputed each crossing from the raw values.
      </p>
      {/*
        Same row treatment as every other check list in the app. The previous
        custom <li className="check-row"> reused a two-column grid meant for
        icon + content, so the first column (24px) cut the check name down to
        "thre"/"peri" and the second column stretched the status chip across the
        whole row.
      */}
      <CheckList
        checks={result.checks.map((c) => ({
          name: c.name as CheckName,
          status: c.status as CheckStatus,
          detail: "",
        }))}
      />
    </div>
  );
}