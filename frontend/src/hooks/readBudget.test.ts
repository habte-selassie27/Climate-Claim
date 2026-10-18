import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads against the public Studio endpoint are capped and shared across every
 * visitor to a deployed site. Reading on mount meant a page view cost 3-6
 * requests, so ordinary traffic exhausted the bucket and visitors got HTTP 429
 * -- which arrives without a CORS header, so it surfaced as an opaque
 * `Failed to fetch` rather than a readable error.
 *
 * These assertions are structural because the behaviour lives in a hook that is
 * awkward to drive in this environment: they pin the thing that actually caused
 * the outage -- a read firing on mount without anyone asking -- and the safety
 * properties that make the change honest rather than merely quiet.
 */

const hookSrc = readFileSync(
  fileURLToPath(new URL("./useRead.ts", import.meta.url)),
  "utf8",
);
const badgeSrc = readFileSync(
  fileURLToPath(new URL("../components/OriginBadge.tsx", import.meta.url)),
  "utf8",
);

describe("useRead does not read on mount", () => {
  it("gates the effect on an explicit request", () => {
    // The whole fix. Without this guard the effect runs on mount and every page
    // view spends requests.
    expect(hookSrc).toMatch(/if \(!liveRequested\) return;/);
  });

  it("defaults autoLive to off", () => {
    expect(hookSrc).toContain("const autoLive = options.autoLive ?? false;");
  });

  it("has no seed path at all, so nothing renders before a live read lands", () => {
    // The recorded snapshot is gone. There is no `seed` argument and no recorded
    // value painted on first frame, so a page cannot show another deployment's
    // records while it waits for the chain.
    expect(hookSrc).not.toMatch(/seed\?:/);
    expect(hookSrc).not.toMatch(/useState\([^)]*seed/);
    // Prose may still say "snapshot" to explain why there is none. What must be
    // absent is the identifier: no snapshot-typed state, no capturedAt.
    expect(hookSrc).not.toMatch(/SNAPSHOT[A-Z_]/);
    expect(hookSrc).not.toMatch(/capturedAt/);
    expect(hookSrc).toContain("useState(autoLive)");
  });

  it("still reads on refresh(), which is how a visitor opts in", () => {
    expect(hookSrc).toContain("setLiveRequested(true)");
    expect(hookSrc).toMatch(/setNonce\(\(n\) => n \+ 1\)/);
  });

  it("exposes whether a live read was requested, for the UI to branch on", () => {
    expect(hookSrc).toContain("liveRequested");
  });

  it("re-reads when deps change after a live read has been requested", () => {
    // Navigating claim A -> B must not strand the user on a snapshot forever.
    expect(hookSrc).toContain("[...deps, nonce, liveRequested]");
  });
});

describe("OriginBadge offers the live read", () => {
  it("renders a refresh control when one is supplied", () => {
    expect(badgeSrc).toContain('data-testid="live-refresh-button"');
  });

  it("states the read cost before the click, not after", () => {
    expect(badgeSrc).toContain("readCost");
  });

  it("retires the button once data is live", () => {
    // Offering to re-read live data invites exactly the traffic being removed.
    // "mixed" was a snapshot-era origin and no longer exists. Only "live"
    // retires the button now.
    expect(badgeSrc).toMatch(/mode === "live"/);
    expect(badgeSrc).not.toMatch(/mode === "mixed"/);
  });

  it("disables the button while a read is in flight", () => {
    expect(badgeSrc).toMatch(/disabled=\{pending\}/);
  });

  it("names rate limiting as rate limiting", () => {
    // The browser sees `Failed to fetch` because the 429 has no CORS header.
    // Reporting that as "source unavailable" would blame the weather source for
    // our own request budget.
    expect(badgeSrc).toMatch(/rate limit\|429\|too many requests/i);
    expect(badgeSrc).toContain("data.rateLimited");
  });

  it("still refuses to present a snapshot as live", () => {
    expect(badgeSrc).toContain("origin.recorded");
    expect(badgeSrc).toContain("origin.live");
  });
});

describe("an unread page is not a failed read", () => {
  const page = (rel: string) =>
    readFileSync(fileURLToPath(new URL(`../pages/${rel}`, import.meta.url)), "utf8");

  it("starts from idle rather than error, so a page reports no failure before it asks", () => {
    // The regression: origin defaulted to "error", so Create claim painted "the
    // policy list could not be read" on a first view and never rendered the
    // form, even though the chain was fine.
    expect(hookSrc).toContain('useState<ReadOrigin>("idle")');
    expect(hookSrc).not.toContain('useState<DataOrigin>("error")');
  });

  it("gives the badge a distinct idle label", () => {
    expect(badgeSrc).toContain("origin.idle");
  });

  it("reads the policy list on mount for Claims -> Create claim", () => {
    // The form is built from list_policies, so waiting for a click would leave
    // the page with nothing to render. The forced read also bypasses a cached
    // list that may predate the policy the user just created.
    expect(page("ClaimNew.tsx")).toMatch(/listPolicies\(true\)[\s\S]{0,80}autoLive: true/);
  });

  it("runs the demo replay on mount instead of waiting for a click", () => {
    expect(page("Demo.tsx")).toMatch(/computeEvaluation[\s\S]{0,240}autoLive: true/);
  });

  it("reads the policy list on mount for Policies, so it cannot say 'none' before reading", () => {
    expect(page("Policies.tsx")).toMatch(/listPolicies\(true\)[\s\S]{0,80}autoLive: true/);
  });

  it("reads the claim list on mount for Claims", () => {
    expect(page("Claims.tsx")).toMatch(/listClaims\(\)[\s\S]{0,80}autoLive: true/);
  });

  it("never caches a failed policy read, or refresh could never recover", () => {
    const svc = readFileSync(
      fileURLToPath(new URL("../services/claimService.ts", import.meta.url)),
      "utf8",
    );
    expect(svc).toContain('if (normalised.origin === "live") policyListCache = normalised;');
    expect(svc).toContain('policyListCache?.origin === "live"');
  });
});

describe("every live-reading page offers the control", () => {
  const pages = ["Policies.tsx", "Claims.tsx", "ClaimDetail.tsx", "Demo.tsx", "PolicyNew.tsx"];

  it.each(pages)("%s passes onRefresh to OriginBadge", (page) => {
    const src = readFileSync(
      fileURLToPath(new URL(`../pages/${page}`, import.meta.url)),
      "utf8",
    );
    const badges = src.match(/<OriginBadge[\s\S]*?\/>/g) ?? [];
    expect(badges.length, `${page} has no OriginBadge`).toBeGreaterThan(0);
    for (const b of badges) {
      expect(b, `${page}: an OriginBadge cannot reach the chain`).toContain("onRefresh=");
    }
  });
});