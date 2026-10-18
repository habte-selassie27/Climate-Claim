import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { listClaims } from "../services/claimService";
import { OriginBadge } from "../components/OriginBadge";
import { decisionCopy, stateCopy } from "../domain/copy";
import {
  CLAIMS_PAGE_SIZE,
  claimStates,
  filterClaims,
  paginate,
  type DecisionFilter,
} from "../domain/claimsQuery";
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

const DECISION_OPTIONS: DecisionFilter[] = [
  "all",
  "confirmed",
  "not_confirmed",
  "inconclusive",
  "pending",
];

/**
 * All claims on the deployed contract. This is the precomposed claims table the
 * demo links into: every row is a real on-chain claim.
 *
 * The table is seeded from the captured snapshot so it paints immediately, then
 * upgrades to live chain data (the origin badge shows which is on screen).
 * Search, the two facet filters and pagination are pure functions in
 * domain/claimsQuery.ts, unit tested there — the page only renders their
 * results. Filtering happens over everything read, and only the result page is
 * drawn, so the table stays usable at hundreds of rows.
 */
export function Claims() {
  const { t } = useI18n();
  const claims = useRead(() => listClaims(), []);
  const rows = (claims.data ?? []) as Claim[];

  const [text, setText] = useState("");
  const [decision, setDecision] = useState<DecisionFilter>("all");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);

  // A filter change invalidates the current page: jumping back to page 1 is
  // the only predictable behaviour when the matching row count shrinks.
  useEffect(() => setPage(1), [text, decision, state]);

  const states = useMemo(() => claimStates(rows), [rows]);
  const filtered = useMemo(
    () => filterClaims(rows, { text, decision, state }),
    [rows, text, decision, state],
  );
  const paged = useMemo(() => paginate(filtered, page, CLAIMS_PAGE_SIZE), [filtered, page]);
  const isFiltered = text.trim() !== "" || decision !== "all" || state !== "";

  const clear = () => {
    setText("");
    setDecision("all");
    setState("");
  };

  return (
    <div className="stack">
      <header>
        <h1>{t("claims.h1")}</h1>
        <p className="lede">
          {/*
            The address must be the one the data was actually READ from, not the
            one currently configured. The recorded snapshot was captured from an
            earlier deployment, so printing CONTRACT_ADDRESS here asserted these
            claims live on a contract that has never held them. On an evidence
            platform that is the one claim that must not be wrong.
          */}
          {t("claims.lede", { address: CONTRACT_ADDRESS, network: net.label })}
        </p>
        <div className="btn-row" style={{ marginTop: "var(--space-2)" }}>
          <Link className="btn" to="/claims/new">
            {t("claimNew.h1")}
          </Link>
        </div>
        <OriginBadge
          mode={claims.origin}
          liveError={claims.liveError}
            pending={claims.refreshing}
          networkLabel={net.label}
          onRefresh={claims.refresh}
          readCost={1}
        />
      </header>

      {claims.loading ? (
        <div className="panel" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ marginBottom: 10 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty" data-testid="claims-empty">
          <p>{t("claims.empty")}</p>
          <Link className="btn" to="/claims/new">
            {t("claimNew.h1")}
          </Link>{" "}
          <Link to="/policies">{t("claims.emptyLink")}</Link>.
        </div>
      ) : (
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2>{t("claims.filter.h")}</h2>
              {isFiltered ? (
                <button
                  type="button"
                  className="copy-btn"
                  onClick={clear}
                  data-testid="claims-clear"
                >
                  {t("claims.filter.clear")}
                </button>
              ) : null}
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="claims-search">{t("claims.filter.search")}</label>
                <input
                  id="claims-search"
                  type="search"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="claims-decision">{t("claims.filter.decision")}</label>
                <select
                  id="claims-decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as DecisionFilter)}
                >
                  {DECISION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d === "all"
                        ? t("claims.filter.all")
                        : d === "pending"
                          ? t("claims.filter.pending")
                          : decisionCopy(d).label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="claims-state">{t("claims.filter.state")}</label>
                <select id="claims-state" value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">{t("claims.filter.all")}</option>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {stateCopy(s as Claim["state"]).label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }} data-testid="claims-showing">
              {t("claims.filter.showing", { shown: filtered.length, total: rows.length })}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="empty" data-testid="claims-nofilter">
              {t("claims.filter.none")}
            </div>
          ) : (
            <div className="panel panel-flush">
              <div className="table-wrap">
                <table data-testid="claims-table">
                  <caption>
                    {t(
                      filtered.length === 1 ? "claims.caption.one" : "claims.caption.many",
                      {
                        count: filtered.length,
                        suffix: "",
                      },
                    )}
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
                    {paged.rows.map((c) => {
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

              {paged.pages > 1 ? (
                <div className="pager" data-testid="claims-pager">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={paged.page <= 1}
                    onClick={() => setPage(paged.page - 1)}
                  >
                    {t("claims.pagination.prev")}
                  </button>
                  <span className="small muted num" data-testid="claims-page-label">
                    {t("claims.pagination.page", { page: paged.page, pages: paged.pages })}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={paged.page >= paged.pages}
                    onClick={() => setPage(paged.page + 1)}
                  >
                    {t("claims.pagination.next")}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <p className="small muted">
        <Link to="/demo">{t("footer.demoMode")}</Link> — {t("claims.footer")}
      </p>
    </div>
  );
}
