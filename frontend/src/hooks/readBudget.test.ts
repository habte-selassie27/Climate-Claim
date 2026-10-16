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

  it("treats a seeded page as already loaded, so no skeleton on a static page", () => {
    expect(hookSrc).toContain("useState(!seeded && autoLive)");
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
    expect(badgeSrc).toMatch(/mode === "live" \|\| mode === "mixed"\)/);
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