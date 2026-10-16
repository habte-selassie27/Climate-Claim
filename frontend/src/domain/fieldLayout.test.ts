import { describe, expect, it } from "vitest";
import {
  FIELD_SCALE,
  MIN_BAR,
  barHeight,
  dayLabel,
  dayX,
  disagreementIndex,
} from "./fieldLayout";

const LONDON_DAYS = [
  "2024-06-01",
  "2024-06-02",
  "2024-06-03",
  "2024-06-04",
  "2024-06-05",
];

describe("barHeight", () => {
  it("scales a real reading by the world scale", () => {
    expect(barHeight(2.03)).toBeCloseTo(2.03 * FIELD_SCALE, 10);
  });

  it("gives a recorded zero the visible minimum, not nothing", () => {
    expect(barHeight(0)).toBe(MIN_BAR);
  });

  it("returns null for a missing reading, so no bar is drawn", () => {
    expect(barHeight(null)).toBeNull();
    expect(barHeight(undefined)).toBeNull();
    expect(barHeight(Number.NaN)).toBeNull();
  });

  it("keeps the disagreement legible: 2.03 clears the 1.50 plane, 1.10 does not", () => {
    // The same relation the contract evaluates, drawn to scale: if this ever
    // flips, the hero would show MERRA-2 under the threshold plane -- wrong.
    const plane = 1.5 * FIELD_SCALE;
    expect(barHeight(2.03)!).toBeGreaterThan(plane);
    expect(barHeight(1.1)!).toBeLessThan(plane);
  });
});

describe("dayX", () => {
  it("centres an odd row on 0", () => {
    expect(dayX(0, 5)).toBe(-3);
    expect(dayX(2, 5)).toBe(0);
    expect(dayX(4, 5)).toBe(3);
  });

  it("puts the 2024-06-04 disagreement at the mock's halo position", () => {
    expect(dayX(3, 5)).toBe(1.5);
  });

  it("returns 0 for a single day", () => {
    expect(dayX(0, 1)).toBe(0);
  });
});

describe("disagreementIndex", () => {
  it("finds the split day inside the period", () => {
    expect(disagreementIndex(["2024-06-04"], LONDON_DAYS)).toBe(3);
  });

  it("takes the earliest split when several exist", () => {
    expect(disagreementIndex(["2024-06-03", "2024-06-04"], LONDON_DAYS)).toBe(2);
  });

  it("ignores split days outside the period", () => {
    expect(disagreementIndex(["2024-05-31"], LONDON_DAYS)).toBe(-1);
  });

  it("returns -1 when nothing disagrees, so no halo is drawn", () => {
    expect(disagreementIndex([], LONDON_DAYS)).toBe(-1);
  });
});

describe("dayLabel", () => {
  it("formats the day the way the mock's tip shows it", () => {
    expect(dayLabel("2024-06-04", "en")).toBe("Jun 4");
  });

  it("keeps the day number readable in every shipped locale", () => {
    for (const locale of ["es", "fr", "de"]) {
      expect(dayLabel("2024-06-04", locale)).toMatch(/4|04/);
    }
  });

  it("falls back to the raw date when the input is unusable", () => {
    expect(dayLabel("not-a-date", "en")).toBe("not-a-date");
  });
});
