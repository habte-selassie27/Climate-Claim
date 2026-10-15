import { Link, useParams } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import {
  listClaims,
  listPolicies,
  listSources,
  snapshotClaims,
  snapshotPolicies,
  snapshotSources,
} from "../services/claimService";
import { DataModeBadge } from "../components/DataModeBadge";
import { OriginBadge } from "../components/OriginBadge";
import { SourceRegistryCard } from "../components/SourceRegistryCard";
import { StartClaimPanel } from "../components/StartClaimPanel";
import { policySentence } from "../domain/copy";
import { fromScaled, microDegrees, periodLabel } from "../domain/format";
import { activeNetwork } from "../config/network";
import type { Claim, Policy, SourceDef } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

export function Policies() {
  const { t } = useI18n();
  const policies = useRead(() => listPolicies(), [], snapshotPolicies());
  const rows = (policies.data ?? []) as Policy[];

  return (
    <div className="stack">
      <header>
        <h1>{t("policies.h1")}</h1>
        <p className="lede">
{t("policies.lede")}
        </p>
        <OriginBadge
          mode={policies.origin}
          capturedAt={policies.capturedAt}
          liveError={policies.liveError}
            pending={policies.refreshing}
          networkLabel={net.label}
        />
        <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
          <Link className="btn" to="/policies/new">
            Create a policy
          </Link>
          <span className="small muted">{t("policies.ownerOnlyNote")}</span>
        </div>
      </header>

      {policies.loading ? (
        <div className="panel" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ marginBottom: 10 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">{t("policies.empty")}</div>
      ) : (
        <div className="panel panel-flush">
          <div className="table-wrap">
            <table data-testid="policies-table">
              <caption>
                {rows.length} polic{rows.length === 1 ? "y" : "ies"} on the deployed contract.
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("policies.col.policy")}</th>
                  <th scope="col">{t("policies.col.location")}</th>
                  <th scope="col">{t("policies.col.condition")}</th>
                  <th scope="col">{t("policies.col.dataMode")}</th>
                  <th scope="col" className="num-col">
                    Claims
                  </th>
                  <th scope="col">{t("policies.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      <Link to={`/policies/${p.id}`}>{p.id}</Link>
                      <div className="small muted">{p.condition_text}</div>
                    </th>
                    <td>
                      {p.location_name}
                      <div className="small muted mono num">
                        {microDegrees(p.lat_scaled)}, {microDegrees(p.lon_scaled)}
                      </div>
                    </td>
                    <td className="num">
                      {p.comparator} {fromScaled(p.threshold_scaled)} {p.unit}
                      <div className="small muted">{p.aggregation.replace("_", " ")}</div>
                    </td>
                    <td>
                      <DataModeBadge mode={p.data_mode} />
                    </td>
                    <td className="num-col num">{p.claim_count}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function PolicyDetail() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const policies = useRead(() => listPolicies(), [], snapshotPolicies());
  const policy = (policies.data ?? []).find((p: Policy) => p.id === id);

  // Claims on this policy, read from the contract.
  const claims = useRead(() => listClaims(), [], snapshotClaims());
  const onPolicy = ((claims.data ?? []) as Claim[]).filter((c) => c.policy_id === id);

  // The registry entries this policy draws from, for the source cards.
  const sources = useRead(() => listSources(), [], snapshotSources());
  const policySources = ((sources.data ?? []) as SourceDef[]).filter((s) =>
    policy ? policy.source_ids.includes(s.id) : false,
  );

  if (policies.loading) {
    return (
      <div className="panel" aria-busy="true">
        <div className="skeleton" style={{ width: "40%", height: 24 }} />
        <div className="skeleton" style={{ marginTop: 12 }} />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="stack">
        <h1>{t("policies.notFound.h")}</h1>
        <div className="alert alert-warn">
          <strong>{t("policies.notFound.title", { id })}</strong>
          <p>
            It may not exist, or the network could not be reached.{" "}
            {policies.liveError ? <span className="mono">{policies.liveError}</span> : null}
          </p>
          <Link className="btn btn-secondary" to="/policies">
            Back to policies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <header>
        <div className="tag-row" style={{ marginBottom: "var(--space-2)" }}>
          <h1 style={{ margin: 0 }}>{t("policies.detail.h", { id: policy.id })}</h1>
          <DataModeBadge mode={policy.data_mode} />
          <OriginBadge
            mode={policies.origin}
            capturedAt={policies.capturedAt}
            liveError={policies.liveError}
            pending={policies.refreshing}
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
      </header>

      {policy.claim_count > 0 ? (
        <div className="alert alert-info">
          <strong>{t("policies.detail.locked")}</strong>
          <p>
            Immutability after first use is what makes a decision auditable later: the terms a
            validator judged against cannot drift.
          </p>
        </div>
      ) : null}

      <div className="claim-grid">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2>{t("policies.terms.h")}</h2>
              <span className="badge">{policy.status}</span>
            </div>
            <dl className="terms">
              <dt>{t("policies.terms.condition")}</dt>
              <dd>{policy.condition_text}</dd>
              <dt>{t("policies.terms.location")}</dt>
              <dd>
                {policy.location_name}{" "}
                <span className="mono num">
                  ({microDegrees(policy.lat_scaled)}, {microDegrees(policy.lon_scaled)})
                </span>
              </dd>
              <dt>{t("policies.terms.tolerance")}</dt>
              <dd className="num">{policy.tolerance_m} m</dd>
              <dt>{t("policies.terms.period")}</dt>
              <dd className="num">
                {periodLabel(policy.period_start, policy.period_end)} {policy.timezone}
              </dd>
              <dt>{t("policies.terms.metric")}</dt>
              <dd>
                {policy.metric} ({policy.unit})
              </dd>
              <dt>{t("policies.terms.aggregation")}</dt>
              <dd>{policy.aggregation.replace("_", " ")}</dd>
              <dt>{t("policies.terms.sources")}</dt>
              <dd>{policy.source_ids.join(", ")}</dd>
              <dt>{t("policies.terms.agreement")}</dt>
              <dd>{policy.agreement_rule}</dd>
              <dt>{t("policies.terms.minSources")}</dt>
              <dd className="num">{policy.min_sources}</dd>
              <dt>{t("policies.terms.payout")}</dt>
              <dd className="num">
                {policy.payout_amount > 0 ? `${policy.payout_amount} base units` : "none"}
              </dd>
              <dt>{t("policies.terms.beneficiary")}</dt>
              <dd className="mono">{policy.beneficiary}</dd>
            </dl>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t("policies.sources.h")}</h2>
              <span className="small muted">from the contract's registry</span>
            </div>
            {policySources.length === 0 ? (
              <p className="small muted">{t("policies.noRegistryMatch")}</p>
            ) : (
              policySources.map((s) => <SourceRegistryCard key={s.id} source={s} />)
            )}
          </div>
        </div>

        <div className="stack">
          <StartClaimPanel policy={policy} onChanged={claims.refresh} />

          <div className="panel">
            <div className="panel-head">
              <h2>{t("policies.claims.h")}</h2>
            </div>
            {onPolicy.length === 0 ? (
              <div className="empty">{t("policies.noClaimsYet")}</div>
            ) : (
              <ul className="checklist">
                {onPolicy.map((c) => (
                  <li key={c.id} className="check-row">
                    <span className="check-icon" aria-hidden="true">
                      {c.id.split("-")[1]}
                    </span>
                    <div>
                      <div className="check-name">
                        <Link to={`/claims/${c.id}`}>{c.id}</Link>
                      </div>
                      <p className="check-detail">
                        {c.decision ? `${c.decision.replace("_", " ")} · ${c.state}` : c.state}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

