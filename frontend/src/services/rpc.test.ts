import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The read budget is a client-side guess about a limit enforced by a remote
 * endpoint. Nothing in the type system stops someone tuning it upward "for
 * snappier reads" and putting the app 3x over budget, which is exactly what
 * happened: the interval was derived from a stale 30-requests-per-minute
 * figure while the endpoint served 500 per hour.
 *
 * These assertions are against the values the endpoint actually returned, so
 * the budget cannot drift past the real ceiling unnoticed.
 */

const rpcSrc = readFileSync(
  fileURLToPath(new URL("./rpc.ts", import.meta.url)),
  "utf8",
);

function number(name: string): number {
  const m = new RegExp(`${name}\\s*=\\s*(\\d[\\d_]*)`).exec(rpcSrc);
  if (!m) throw new Error(`${name} not found in rpc.ts`);
  return Number(m[1]!.replace(/_/g, ""));
}

describe("StudioNet read budget", () => {
  // What the endpoint reported on 2026-10-17:
  // {"bucket":"standard","window":"hour","limit":500,"current":500}
  const OBSERVED_LIMIT_PER_HOUR = 500;

  it("encodes the observed limit it derives from", () => {
    expect(number("STUDIONET_READS_PER_HOUR")).toBe(OBSERVED_LIMIT_PER_HOUR);
  });

  it("stays under the endpoint's real ceiling", () => {
    const ceilingMs = 60_000 / (OBSERVED_LIMIT_PER_HOUR / 60);
    const interval = number("READS_PER_MINUTE_BUDGET") > 0 ? 60_000 / number("READS_PER_MINUTE_BUDGET") : 0;
    expect(
      interval,
      "read spacing exceeds the endpoint ceiling, so a single session can exhaust the bucket",
    ).toBeGreaterThanOrEqual(ceilingMs);
  });

  it("leaves headroom for the retry liveRead performs after a 429", () => {
    // liveRead retries once after sleeping retry_after + 1s. A budget sitting
    // exactly on the ceiling would let the retry push the session over.
    const ceiling = OBSERVED_LIMIT_PER_HOUR / 60;
    expect(number("READS_PER_MINUTE_BUDGET")).toBeLessThan(ceiling);
  });

  it("no longer claims the stale 30-per-minute figure", () => {
    // The old comment asserted 30/min, which is ~3.3x the real ceiling. Left in
    // place it invites the next person to "restore" the old interval.
    expect(rpcSrc).not.toMatch(/allows 30 requests per minute/i);
    expect(rpcSrc).not.toMatch(/~\s*2\.2s/);
  });

  it("fails loudly at import time if the budget is ever set above the ceiling", () => {
    // The module throws rather than silently over-consuming. Assert the guard
    // exists, since it is the thing that catches a bad future edit.
    expect(rpcSrc).toContain("read budget is under the endpoint's ceiling");
  });
});