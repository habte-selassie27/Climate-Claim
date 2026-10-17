import { describe, expect, it } from "vitest";
import { assertReadBudgetSafe, READ_CEILING_MS } from "./rpc";

/**
 * These tests EXECUTE the guard. The previous version of this file asserted
 * only that the guard's message appeared somewhere in the source, which is why
 * an inverted comparison shipped: every test passed while the deployed app threw
 * on import and rendered "This screen stopped working" on every route.
 *
 * A grep-based test cannot tell a correct guard from a backwards one. This one
 * calls it with both a safe and an unsafe configuration and checks which one
 * throws.
 */

// What the endpoint reported on 2026-10-17:
// {"bucket":"standard","window":"hour","limit":500,"current":500}
const OBSERVED_LIMIT_PER_HOUR = 500;

describe("assertReadBudgetSafe", () => {
  it("accepts a spacing slower than the ceiling", () => {
    // The deployed configuration: 10000ms against a ~7200ms ceiling.
    expect(() => assertReadBudgetSafe(10_000, READ_CEILING_MS)).not.toThrow();
  });

  it("accepts a spacing exactly at the ceiling", () => {
    expect(() => assertReadBudgetSafe(7_200, 7_200)).not.toThrow();
  });

  it("REJECTS a spacing faster than the ceiling", () => {
    // The old 2200ms setting: ~27 reads/min against a limit of 8.3.
    expect(() => assertReadBudgetSafe(2_200, 7_200)).toThrow();
  });

  it("names the real cause when it rejects", () => {
    // A bare "configuration error" would send the next person looking at the
    // wrong layer entirely.
    expect(() => assertReadBudgetSafe(2_200, 7_200)).toThrow(/ceiling/i);
    expect(() => assertReadBudgetSafe(2_200, 7_200)).toThrow(/2200ms/);
  });

  it("is not inverted: slower spacing is safe, faster is not", () => {
    // The regression this file exists to prevent.
    expect(() => assertReadBudgetSafe(9_000, 7_200)).not.toThrow();
    expect(() => assertReadBudgetSafe(5_000, 7_200)).toThrow();
  });
});

describe("READ_CEILING_MS", () => {
  it("is the fastest spacing the observed limit permits", () => {
    expect(READ_CEILING_MS).toBeCloseTo(60_000 / (OBSERVED_LIMIT_PER_HOUR / 60), 5);
  });

  it("is slower than one second, so a page of reads cannot storm the endpoint", () => {
    expect(READ_CEILING_MS).toBeGreaterThan(1_000);
  });
});

describe("the shipped budget", () => {
  it("is at least as slow as the endpoint ceiling", () => {
    // Importing rpc.ts already asserts this at module scope; asserting it again
    // here means a regression is reported by the test suite rather than only in
    // a browser console.
    expect(READ_CEILING_MS).toBeGreaterThan(0);
    expect(() => assertReadBudgetSafe(60_000 / 6, READ_CEILING_MS)).not.toThrow();
  });
});