import { Link } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { listClaims, snapshotClaims } from "../services/claimService";
import { OriginBadge } from "../components/OriginBadge";
import { decisionCopy, stateCopy } from "../domain/copy";
import { activeNetwork } from "../config/network";
import { CONTRACT_ADDRESS } from "../config/contracts";
import type { Claim } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

const TONE_CLASS: Record<string, string> = {
  confirmed: "finality-final",
  "not-confirmed": "finality-pending",
  inconclusive: "finality-accepted",
};

const TONE_ICON: Record<string, string> = {
  confirmed: "✓",
  "not-confirmed": "✕",
  inconclusive: "?",
};

/**
 * All claims on the deployed contract. This is the precomposed claims table the
 * demo links into: every row is a real on-chain claim.
 */
export function Claims() {
  const { t } = useI18n();
  // Seeded from the captured snapshot so the table paints immediately, then
  // upgrades to live chain data. The origin badge shows which is on screen.
  const claims = useRead(() => listClaims(), [], snapshotClaims());
  const rows = (claims.data ?? []) as Claim[];

  return (
    <div className="stack">
      <header>
        <h1>{t("claims.h1")}</h1>
        <p className="lede">
          {t("claims.lede", { address: CONTRACT_ADDRESS, network: net.label })}
        </p>
        <OriginBadge
          mode={claims.origin}
          capturedAt={claims.capturedAt}
          liveError={claims.liveError}
            pending={claims.refreshing}
          networkLabel={net.label}
        />
      </header>

      {claims.loading ? (
        <div className="panel" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ marginBottom: 10 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          {t("claims.empty")} <Link to="/policies">{t("claims.emptyLink")}</Link>.
        </div>
      ) : (
        <div className="panel panel-flush">
          <div className="table-wrap">
            <table data-testid="claims-table">
              <caption>
                {t(rows.length === 1 ? "claims.caption.one" : "claims.caption.many", {
                  count: rows.length,
                  suffix:
                    claims.origin === "snapshot" ? t("claims.captionSnapshot") : "",
                })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("claims.col.claim")}</th>
                  <th scope="col">{t("claims.col.policy")}</th>
                  <th scope="col">{t("claims.col.state")}</th>
                  <th scope="col">{t("claims.col.decision")}</th>
                  <th scope="col" className="num-col">
                    {t("claims.col.round")}
                  </th>
                  <th scope="col">{t("claims.col.final")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const copy = decisionCopy(c.decision);
                  return (
                    <tr key={c.id}>
                      <th scope="row">
                        <Link to={`/claims/${c.id}`}>{c.id}</Link>
                      </th>
                      <td className="mono">{c.policy_id}</td>
                      <td>{stateCopy(c.state).label}</td>
                      <td>
                        {c.decision ? (
                          <span className={`finality-chip ${TONE_CLASS[copy.tone]}`}>
                            <span aria-hidden="true">{TONE_ICON[copy.tone]}</span>
                            {copy.label}
                          </span>
                        ) : c.eval_error ? (
                          <span className="finality-chip finality-failed">
                            <span aria-hidden="true">!</span> {t("claims.evalFailed")}
                          </span>
                        ) : (
                          <span className="muted">{t("common.notEvaluated")}</span>
                        )}
                      </td>
                      <td className="num-col num">{c.eval_round}</td>
                      <td>{c.finalized ? t("common.yes") : t("common.no")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="small muted">
        <Link to="/demo">{t("footer.demoMode")}</Link> — {t("claims.footer")}
      </p>
    </div>
  );
}
