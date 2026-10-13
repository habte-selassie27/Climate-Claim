import { Link } from "react-router-dom";
import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import { EvidenceChart } from "../components/EvidenceChart";
import { DEMO_SCENARIOS } from "../fixtures/demoScenarios";
import { fromScaled } from "../domain/format";

const net = activeNetwork();

/**
 * Landing. Says what ClimateClaim is and shows it working, using a real
 * recorded scenario rather than an illustration.
 */
export function Landing() {
  const scenario = DEMO_SCENARIOS.find((s) => s.id === "conflicting-sources")!;

  return (
    <div className="stack">
      <section>
        <h1>Did the weather actually do that?</h1>
        <p className="lede">
          ClimateClaim checks recorded weather observations against a policy you write in plain
          language, and shows you the readings that produced the answer. When the evidence is
          incomplete or the sources disagree, it says so instead of guessing.
        </p>
        <div className="btn-row">
          <Link className="btn" to="/demo">
            Open the demo
          </Link>
          <Link className="btn btn-secondary" to="/demo?scenario=conflicting-sources">
            See the source conflict
          </Link>
          <Link className="btn btn-secondary" to="/claims">
            See real claims
          </Link>
        </div>
      </section>

      <div className="panel">
        <div className="panel-head">
          <h2>A real disagreement</h2>
          <span className="badge badge-sim">
            <span aria-hidden="true">▤</span> Historical simulation
          </span>
        </div>
        <p>
          Two independent reanalyses of the same place, same day. One says 1.10 mm, the other says
          2.03 mm. Against a 1.50 mm threshold, one crosses and one does not. The honest answer is
          inconclusive, and that is a result rather than an error.
        </p>
        <EvidenceChart
          series={scenario.series}
          period={scenario.period}
          thresholdScaled={scenario.policy.threshold_scaled}
          comparator={scenario.policy.comparator}
          unit={scenario.policy.unit}
        />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Why GenLayer</h2>
          <p>
            Weather evidence is not clean. A source can be down, can return only part of the
            period, and two equally reputable reanalyses can disagree by a factor of two. A policy
            also needs interpreting: which station counts as "the area", whether a day at exactly
            the threshold counts, what to do when two sources disagree.
          </p>
          <p>
            Validators here independently fetch the same sources and compare{" "}
            <em>meaning</em>, not bytes. Where the evidence genuinely does not settle the question,
            the contract returns <code>inconclusive</code> instead of forcing a yes or no.
          </p>
          <Link to="/how-it-works">How consensus, equivalence and finality work</Link>
        </div>

        <div className="panel">
          <h2>What it will not do</h2>
          <ul>
            <li>Invent, interpolate or estimate a missing reading.</li>
            <li>Let a language model do the threshold arithmetic — that is plain integer code.</li>
            <li>Pick the friendlier source to make a claim pass.</li>
            <li>Settle a payout on a decision that is merely accepted.</li>
            <li>Present recorded historical data as if it were live.</li>
          </ul>
          <p className="small muted">
            Deployed at <span className="mono">{CONTRACT_ADDRESS}</span> on {net.label} (chain{" "}
            {net.chainId}). {fromScaled(120)} thresholds and amounts are stored as scaled integers,
            never floats.
          </p>
        </div>
      </div>
    </div>
  );
}