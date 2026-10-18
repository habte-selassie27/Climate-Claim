import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A live read against StudioNet fails in a way that produces NO error message at
 * all: a 429 arrives without CORS headers, the browser discards it, and the SDK
 * hands back an object whose every string field is empty.
 *
 * That path previously ended in "Unknown error", which surfaced in the UI as
 * "The network could not be reached (Unknown)" -- technically true, practically
 * useless, and it reads as an app bug rather than a full read budget.
 *
 * errorMessage is module-private, so this pins the behaviour structurally. If it
 * is ever exported, convert these to direct calls.
 */

const src = readFileSync(
  fileURLToPath(new URL("./evaluationService.ts", import.meta.url)),
  "utf8",
);

describe("errorMessage fallback", () => {
  it("does not RETURN 'Unknown error'", () => {
    // Matches the returned literal, not the comment that explains why it was
    // removed -- a naive substring check flags its own documentation.
    expect(src).not.toMatch(/return\s+"Unknown error"/);
  });

  it("explains the blocked-request case instead", () => {
    // A bare fallback that names no cause gives the reader nothing to act on.
    expect(src).toMatch(/blocked before it could be read/i);
  });

  it("names the real cause, so a full read budget is not mistaken for a bug", () => {
    expect(src).toMatch(/without CORS headers/i);
  });

  it("still surfaces a real error message when one exists", () => {
    // The fallback must not swallow informative errors: the loop that returns
    // the first non-empty candidate has to come first.
    const fallbackAt = src.indexOf("blocked before it could be read");
    const loopAt = src.search(/for \(const candidate of candidates\)/);
    expect(loopAt).toBeGreaterThan(-1);
    expect(fallbackAt).toBeGreaterThan(loopAt);
  });

  it("prefers the deterministic error prefixes when present", () => {
    // EXPECTED / EXTERNAL / TRANSIENT / LLM_ERROR must still win over prose,
    // because the UI maps them to specific advice.
    expect(src).toMatch(/\^\(EXPECTED\|EXTERNAL\|TRANSIENT\|LLM_ERROR\|EXECUTION\)/);
  });
});

describe("create-policy prerequisite hint", () => {
  const page = readFileSync(
    fileURLToPath(new URL("../pages/PolicyNew.tsx", import.meta.url)),
    "utf8",
  );

  it("warns before the click, not only after it fails", () => {
    expect(page).toContain("create-prereq");
    expect(page).toContain("policyNew.prereq.wallet");
    expect(page).toContain("policyNew.prereq.noWallet");
  });

  it("leaves the submit button enabled, so form validation still reports first", () => {
    // Disabling on the wallet gate would hide field errors from an incomplete
    // form, which is the opposite of helpful.
    expect(page).toMatch(/disabled=\{busy\}/);
  });

  it("hides the hint while a transaction is in flight", () => {
    expect(page).toMatch(/!wallet\.connected && !busy/);
  });
});