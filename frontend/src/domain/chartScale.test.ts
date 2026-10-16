import { describe, expect, it } from "vitest";
import { formatTick, niceScale } from "./chartScale";

describe("niceScale", () => {
  it("fixes the uneven-label regression on a 2.5mm axis", () => {
    // The old code produced 0.0 / 0.6 / 1.3 / 1.9 / 2.5 for this range.
    const s = niceScale(2.03 * 1.15);
    expect(formatTick(s.top, s.decimals)).toBe("2.5");
    expect(s.ticks.map((t) => formatTick(t, s.decimals))).toEqual([
      "0.0",
      "0.5",
      "1.0",
      "1.5",
      "2.0",
      "2.5",
    ]);
  });

  it("always produces evenly spaced, round labels", () => {
    for (const max of [0.03, 0.9, 1.1, 2.03, 7, 23.5, 140, 1800]) {
      const s = niceScale(max);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
      // Every tick is a multiple of the step, within float tolerance.
      for (const t of s.ticks) {
        expect(Math.abs(t / s.step - Math.round(t / s.step))).toBeLessThan(1e-9);
      }
      // The top always covers the data.
      expect(s.top).toBeGreaterThanOrEqual(max);
    }
  });

  it("keeps the tick count near the target", () => {
    for (const max of [1, 2.03, 9.9, 47, 512]) {
      const n = niceScale(max, 4).ticks.length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("handles sub-1 values without collapsing to one tick", () => {
    const s = niceScale(0.03);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
    expect(s.top).toBeGreaterThanOrEqual(0.03);
  });

  it("survives degenerate input", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = niceScale(bad);
      expect(Number.isFinite(s.top)).toBe(true);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
      expect(s.ticks.every(Number.isFinite)).toBe(true);
    }
  });

  it("does not drift across the axis (float accumulation)", () => {
    // Repeated addition would give 0.30000000000000004-style ticks here.
    const s = niceScale(1, 10);
    expect(s.ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });
});

describe("formatTick", () => {
  it("uses the scale's precision", () => {
    expect(formatTick(1.5, 1)).toBe("1.5");
    expect(formatTick(1.5, 2)).toBe("1.50");
  });

  it("never renders negative zero", () => {
    expect(formatTick(-0, 1)).toBe("0.0");
    expect(formatTick(-0, 2)).toBe("0.00");
  });
});