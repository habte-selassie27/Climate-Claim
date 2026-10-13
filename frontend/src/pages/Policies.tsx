import { Link, useParams } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { listClaims, listPolicies, snapshotClaims, snapshotPolicies } from "../services/claimService";
import { DataModeBadge } from "../components/DataModeBadge";
import { OriginBadge } from "../components/OriginBadge";
import { policySentence } from "../domain/copy";
import { fromScaled, microDegrees, periodLabel } from "../domain/format";
import { activeNetwork } from "../config/network";
import type { Claim, Policy } from "../domain/types";

const net = activeNetwork();

export function Policies() {
  const policies = useRead(() => listPolicies(), [], snapshotPolicies());
  const rows = (policies.data ?? []) as Policy[];

  return (
    <div className="stack">
      <header>
        <h1>Policies</h1>
        <p className="lede">
          A policy fixes the location, period, threshold, aggregation rule and eligible sources. Once
          a claim references it, it cannot be changed.
        </p>
        <OriginBadge
          mode={policies.origin}
          capturedAt={policies.capturedAt}
          liveError={policies.liveError}
            pending={policies.refreshing}
          networkLabel={net.label}
        />
      </header>

      {policies.loading ? (
        <div className="panel" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ marginBottom: 10 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          No policies yet. Open the demo to see what a policy produces.
        </div>
      ) : (
        <div className="panel panel-flush">
          <div className="table-wrap">
            <table data-testid="policies-table">
              <caption>
                {rows.length} polic{rows.length === 1 ? "y" : "ies"} on the deployed contract.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Policy</th>
                  <th scope="col">Location</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Data mode</th>
                  <th scope="col" className="num-col">
                    Claims
                  </th>
                  <th scope="col">Status</th>
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
  const { id = "" } = useParams();
  const policies = useRead(() => listPolicies(), [], snapshotPolicies());
  const policy = (policies.data ?? []).find((p: Policy) => p.id === id);

  // Claims on this policy, read from the contract.
  const claims = useRead(() => listClaims(), [], snapshotClaims());
  const onPolicy = ((claims.data ?? []) as Claim[]).filter((c) => c.policy_id === id);

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
        <h1>Policy not found</h1>
        <div className="alert alert-warn">
          <strong>No policy called “{id}”</strong>
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
          <h1 style={{ margin: 0 }}>Policy {policy.id}</h1>
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
          <strong>This policy is referenced by a claim, so it can no longer be changed.</strong>
          <p>
            Immutability after first use is what makes a decision auditable later: the terms a
            validator judged against cannot drift.
          </p>
        </div>
      ) : null}

      <div className="claim-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Terms</h2>
            <span className="badge">{policy.status}</span>
          </div>
          <dl className="terms">
            <dt>Condition</dt>
            <dd>{policy.condition_text}</dd>
            <dt>Location</dt>
            <dd>
              {policy.location_name}{" "}
              <span className="mono num">
                ({microDegrees(policy.lat_scaled)}, {microDegrees(policy.lon_scaled)})
              </span>
            </dd>
            <dt>Distance tolerance</dt>
            <dd className="num">{policy.tolerance_m} m</dd>
            <dt>Observation period</dt>
            <dd className="num">
              {periodLabel(policy.period_start, policy.period_end)} {policy.timezone}
            </dd>
            <dt>Metric</dt>
            <dd>
              {policy.metric} ({policy.unit})
            </dd>
            <dt>Aggregation</dt>
            <dd>{policy.aggregation.replace("_", " ")}</dd>
            <dt>Eligible sources</dt>
            <dd>{policy.source_ids.join(", ")}</dd>
            <dt>Agreement rule</dt>
            <dd>{policy.agreement_rule}</dd>
            <dt>Minimum sources</dt>
            <dd className="num">{policy.min_sources}</dd>
            <dt>Payout</dt>
            <dd className="num">
              {policy.payout_amount > 0 ? `${policy.payout_amount} base units` : "none"}
            </dd>
            <dt>Beneficiary</dt>
            <dd className="mono">{policy.beneficiary}</dd>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Claims on this policy</h2>
          </div>
          {onPolicy.length === 0 ? (
            <div className="empty">No claims yet on this policy.</div>
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
  );
}

