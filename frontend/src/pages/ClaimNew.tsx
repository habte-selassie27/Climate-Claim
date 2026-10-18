import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { listPolicies } from "../services/claimService";
import { StartClaimPanel } from "../components/StartClaimPanel";
import { OriginBadge } from "../components/OriginBadge";
import { POLICY_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import type { Policy } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Create a claim.
 *
 * Claims are created against a policy that exists on the POLICY contract. This
 * page lists those policies live and hands the chosen one to `StartClaimPanel`,
 * which submits `start_claim(policy_id, period_start, period_end)`.
 *
 * A LIMITATION WORTH STATING UP FRONT, because it will otherwise look like a
 * bug: ClimateClaim's `start_claim` accepts a policy id, and the only way that
 * id becomes known to it is `register_policy_snapshot`, which is OWNER-ONLY.
 * So a brand-new policy cannot back a claim until the owner bridges it across.
 * Rather than hide that, the page says so and names the method.
 *
 * Nothing here fabricates a claim. If no policy exists, the page offers to
 * create one; if the write fails, the failure is shown as the contract reported
 * it.
 */
export function ClaimNew() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Read on mount: this page IS the form built from the policy list, so an
  // unread page has nothing to show. One read, and a fresh one — the cached
  // list may predate a policy the user just created.
  const policies = useRead(() => listPolicies(true), [], { autoLive: true });
  const rows = (policies.data ?? []) as Policy[];
  const active = rows.filter((p) => p.status === "active");
  const [selected, setSelected] = useState("");

  // Default to the first active policy once the list lands, but never move the
  // user's choice out from under them.
  useEffect(() => {
    if (!selected && active.length > 0) setSelected(active[0].id);
  }, [active, selected]);

  const policy = rows.find((p) => p.id === selected);

  return (
    <div className="stack">
      <header>
        <h1>{t("claimNew.h1")}</h1>
        <p className="lede">
          {t("claimNew.lede", { address: POLICY_ADDRESS, network: net.label })}
        </p>
        <OriginBadge
          mode={policies.origin}
          liveError={policies.liveError}
          pending={policies.loading || policies.refreshing}
          networkLabel={net.label}
          onRefresh={policies.refresh}
          readCost={1}
        />
      </header>

      {policies.loading ? (
        <div className="panel" aria-busy="true">
          <p className="small muted">{t("data.refreshing")}</p>
          <div className="skeleton" style={{ height: 90 }} />
        </div>
      ) : policies.origin === "idle" ? (
        // Reachable only if the read is turned off again; say what is true
        // rather than reporting a failure that has not happened.
        <div className="empty" data-testid="claim-new-idle">
          <p>{t("origin.idle")}</p>
          <button type="button" className="btn" onClick={policies.refresh}>
            {t("data.refreshLive")}
          </button>
        </div>
      ) : policies.origin === "error" ? (
        <div className="alert alert-warn" data-testid="claim-new-read-error">
          <strong>{t("claimNew.cantRead")}</strong>
          {policies.liveError ? <p className="small mono">{policies.liveError}</p> : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={policies.refresh}
            disabled={policies.refreshing}
          >
            {t("data.refreshLive")}
          </button>
        </div>
      ) : active.length === 0 ? (
        <div className="empty" data-testid="claim-new-no-policies">
          <p>{t("claimNew.noPolicies")}</p>
          <Link className="btn" to="/policies/new">
            {t("claimNew.createPolicy")}
          </Link>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="field">
              <label htmlFor="claim-new-policy">{t("claimNew.pickPolicy")}</label>
              <select
                id="claim-new-policy"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.location_name} — {p.condition_text}
                  </option>
                ))}
              </select>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              {t("claimNew.count", { shown: active.length, total: rows.length })}
            </p>
          </div>

          {policy ? (
            <StartClaimPanel
              policy={policy}
              onChanged={() => {
                policies.refresh();
                // Land on the claim that was just made, once its id resolves.
                setTimeout(() => navigate(`/claims`), 400);
              }}
            />
          ) : null}

          <div className="alert alert-info">
            <strong>{t("claimNew.bridge.h")}</strong>
            <p>{t("claimNew.bridge.body")}</p>
          </div>
        </>
      )}

      <p className="small muted">
        <Link to="/claims">{t("claims.h1")}</Link>
      </p>
    </div>
  );
}