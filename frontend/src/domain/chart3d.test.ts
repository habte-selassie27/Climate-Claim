import { describe, expect, it } from "vitest";
import { MIN_COLUMN, columnHeight, revealDelayMs, sourceOffsetX, spacingFor } from "./chart3d";

describe("columnHeight", () => {
  it("draws nothing for a missing reading", () => {
    expect(columnHeight(null, 2, 3)).toBeNull();
    expect(columnHeight(undefined, 2, 3)).toBeNull();
    expect(columnHeight(Number.NaN, 2, 3)).toBeNull();
  });

  it("keeps a recorded zero visible as a hairline", () => {
    expect(columnHeight(0, 2, 3)).toBe(MIN_COLUMN);
  });

  it("is linear in the reading", () => {
    const a = columnHeight(1, 4, 3)!;
    const b = columnHeight(2, 4, 3)!;
    expect(b).toBeCloseTo(a * 2, 10);
    expect(columnHeight(4, 4, 3)).toBeCloseTo(3, 10);
  });

  it("never inverts an unusual axis", () => {
    expect(columnHeight(1, 0, 3)).toBe(MIN_COLUMN);
  });
});

describe("spacingFor", () => {
  it("keeps short periods spread out", () => {
    expect(spacingFor(5)).toBe(1.35);
    expect(spacingFor(1)).toBe(1.35);
  });

  it("compresses long periods toward the floor", () => {
    expect(spacingFor(30)).toBe(0.5);
    expect(spacingFor(12)).toBe(1);
  });

  it("never increases as the period grows", () => {
    let previous = Infinity;
    for (let n = 1; n <= 60; n += 1) {
      const s = spacingFor(n);
      expect(s).toBeLessThanOrEqual(previous);
      previous = s;
    }
  });
});

describe("sourceOffsetX", () => {
  it("centres a single source", () => {
    expect(sourceOffsetX(0, 1, 0.5)).toBe(0);
  });

  it("splits two sources symmetrically", () => {
    expect(sourceOffsetX(0, 2, 0.5)).toBe(-0.25);
    expect(sourceOffsetX(1, 2, 0.5)).toBe(0.25);
  });

  it("centres three sources", () => {
    expect(sourceOffsetX(1, 3, 0.5)).toBe(0);
    expect(sourceOffsetX(0, 3, 0.5)).toBe(-0.5);
  });
});

describe("revealDelayMs", () => {
  it("sweeps day-major, bounded for long periods", () => {
    expect(revealDelayMs(0, 0, 5)).toBe(0);
    expect(revealDelayMs(1, 0, 5)).toBeGreaterThan(revealDelayMs(0, 0, 5));
    // Last day of a 31-day period starts well inside two seconds.
    expect(revealDelayMs(30, 1, 31)).toBeLessThan(2000);
  });

  it("delays later sources within the same day", () => {
    expect(revealDelayMs(2, 1, 5) - revealDelayMs(2, 0, 5)).toBe(45);
  });
});
