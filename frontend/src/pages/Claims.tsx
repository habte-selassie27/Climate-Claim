import { Link } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { listClaims, snapshotClaims } from "../services/claimService";
import { OriginBadge } from "../components/OriginBadge";
import { decisionCopy, stateCopy } from "../domain/copy";
import { activeNetwork } from "../config/network";
import type { Claim } from "../domain/types";

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
  // Seeded from the captured snapshot so the table paints immediately, then
  // upgrades to live chain data. The origin badge shows which is on screen.
  const claims = useRead(() => listClaims(), [], snapshotClaims());
  const rows = (claims.data ?? []) as Claim[];

  return (
    <div className="stack">
      <header>
        <h1>Claims</h1>
        <p className="lede">
          Every claim below exists on the deployed contract at{" "}
          <span className="mono">0xE16032420e3155C0822e9150a98c6B1163869F0c</span> on {net.label}.
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
          No claims yet. Start one from a policy on the <Link to="/policies">policies page</Link>.
        </div>
      ) : (
        <div className="panel panel-flush">
          <div className="table-wrap">
            <table data-testid="claims-table">
              <caption>
                {rows.length} claim{rows.length === 1 ? "" : "s"} read from the chain
                {claims.origin === "snapshot" ? " (recorded snapshot)" : ""}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Claim</th>
                  <th scope="col">Policy</th>
                  <th scope="col">State</th>
                  <th scope="col">Decision</th>
                  <th scope="col" className="num-col">
                    Round
                  </th>
                  <th scope="col">Final</th>
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
                            <span aria-hidden="true">!</span> Evaluation did not complete
                          </span>
                        ) : (
                          <span className="muted">not evaluated</span>
                        )}
                      </td>
                      <td className="num-col num">{c.eval_round}</td>
                      <td>{c.finalized ? "yes" : "no"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="small muted">
        <Link to="/demo">Demo mode</Link> replays eight documented scenarios, including ones with no
        on-chain claim.
      </p>
    </div>
  );
}