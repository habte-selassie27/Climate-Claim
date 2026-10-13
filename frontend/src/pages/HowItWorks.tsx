import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";

const net = activeNetwork();

/**
 * How it works. Plain language, no overclaiming. GenLayer terms are explained
 * once, in place, where they appear.
 */
export function HowItWorks() {
  return (
    <div className="stack">
      <header>
        <h1>How a decision is reached</h1>
        <p className="lede">
          One leader proposes a result, several validators check it independently, and the result is
          only kept if enough of them agree it means the same thing.
        </p>
      </header>

      <section className="panel">
        <h2>Leader and validators</h2>
        <p>
          For an evaluation, one leader fetches the eligible sources and produces a structured
          result: a decision, a reason, five per-check statuses and an observed value. That proposal
          is not taken on trust. Each validator fetches the same sources itself, evaluates them under
          the policy's rules, and produces its own result.
        </p>
        <p>
          The result is kept when the validators&rsquo; conclusions are equivalent — that is, when
          they mean the same thing, even if their wording differs. A validator whose own result
          disagrees rejects the proposal rather than deferring to it.
        </p>
      </section>

      <section className="panel">
        <h2>What counts as the same answer</h2>
        <p>
          Weather text is not compared byte for byte. Two results are treated as equivalent when:
        </p>
        <ul>
          <li>the decision matches exactly;</li>
          <li>the reason is the same, or within a documented equivalence group;</li>
          <li>every required check — threshold crossed, period covered, data complete — matches;</li>
          <li>
            the observed value is within a documented tolerance{" "}
            <em>and</em> sits on the same side of the threshold as the decision.
          </li>
        </ul>
        <p>
          That last condition is a deliberate guard. A validator will not accept a{" "}
          <code>confirmed</code> whose own numbers fail the threshold, so validators cannot agree on
          something that is simply wrong. Units and timezones are normalised before any comparison,
          and threshold arithmetic is plain integer code — never the language model&rsquo;s job.
        </p>
      </section>

      <section className="panel">
        <h2>Why “inconclusive” exists</h2>
        <p>
          When the evidence does not settle the question, the honest answer is that it does not
          settle the question. ClimateClaim returns <code>inconclusive</code> for four distinct
          situations:
        </p>
        <ul>
          <li>
            <strong>Source conflict</strong> — two sources disagree about crossing, and the policy
            defines no tie-break.
          </li>
          <li>
            <strong>Missing observations</strong> — the period is not fully covered. The gap is
            reported, never filled in.
          </li>
          <li>
            <strong>Location mismatch</strong> — the reported station is further from the policy
            point than the policy&rsquo;s own tolerance allows.
          </li>
          <li>
            <strong>Sources unreachable</strong> — nothing could be retrieved, so there was nothing
            to evaluate.
          </li>
        </ul>
        <p>
          This is a result, not an error. It is also the clearest argument for GenLayer: a single
          deterministic chain reading one API would have to either pass or fail the claim, and would
          have no honest way to express the gap.
        </p>
      </section>

      <section className="panel">
        <h2>Accepted is not final</h2>
        <p>
          When validators agree, the result is <strong>accepted</strong>. It can still be appealed.
          Only after the network finalises it does it become <strong>final</strong>, and only then
          can a payout happen. This app shows those two states separately at every level, and the
          settle button stays disabled until the contract itself reports the decision as final.
        </p>
        <p>
          A settled claim can only be settled once. The contract records a settlement state and
          checks it before any transfer, so a repeated call cannot pay twice.
        </p>
      </section>

      <section className="panel">
        <h2>Historical simulation versus live</h2>
        <p>
          A <strong>historical simulation</strong> claim is judged against recorded observations. The
          values are fixed; re-running the claim does not change them. A <strong>live</strong> claim
          is judged against data fetched at evaluation time, and a new evaluation can produce a new
          answer. Every policy and claim surface in this app carries a badge saying which one it is.
        </p>
        <p>
          The evidence shown in this app is read from the deployed contract at{" "}
          <span className="mono">{CONTRACT_ADDRESS}</span> on {net.label} (chain {net.chainId}).
          When a chain read is not possible, the page says so and shows a recorded snapshot instead
          of silently presenting stale data as live.
        </p>
      </section>

      <section className="panel">
        <h2>Limitations</h2>
        <ul>
          <li>
            Weather sources differ by a factor of two on the same day. That is real model spread, not
            a bug, and it is exactly why agreement rules exist.
          </li>
          <li>
            Reanalysis sources report the grid cell they used, which can sit several kilometres from
            the point you asked for. A tight distance tolerance will produce inconclusive results.
          </li>
          <li>
            The public StudioNet endpoint is rate limited to 30 requests per minute, so reads are
            spaced out and de-duplicated.
          </li>
          <li>
            {net.explorerAvailable
              ? "Claims on the public test networks are not settled for real value."
              : "The StudioNet explorer is currently paused, so transaction links are shown as unavailable rather than as dead links."}
          </li>
        </ul>
      </section>
    </div>
  );
}