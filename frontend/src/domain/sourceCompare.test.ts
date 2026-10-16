import { describe, expect, it } from "vitest";
import { compareSources, meetsThreshold, perSourceVerdicts, round2 } from "./sourceCompare";

/**
 * The numbers below are the recorded fixture values for London 2024-06-01 →
 * 2024-06-05 (fixtures/historical/london_2024-06-01_2024-06-05.json), the same
 * readings the conflicting-sources demo scenario uses.
 */
const OM = {
  sourceId: "om_archive_precip",
  label: "Open-Meteo ERA5",
  daily: {
    "2024-06-01": 0.1,
    "2024-06-02": 0.2,
    "2024-06-03": 0.0,
    "2024-06-04": 1.1,
    "2024-06-05": 0.0,
  } as Record<string, number | null>,
};

const NASA = {
  sourceId: "nasa_precip",
  label: "NASA POWER",
  daily: {
    "2024-06-01": 0.23,
    "2024-06-02": 0.1,
    "2024-06-03": 0.15,
    "2024-06-04": 2.03,
    "2024-06-05": 0.02,
  } as Record<string, number | null>,
};

const DATES = ["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-04", "2024-06-05"];

describe("meetsThreshold", () => {
  it("respects gt vs gte at the boundary", () => {
    expect(meetsThreshold(1.1, 1.1, "gte")).toBe(true);
    expect(meetsThreshold(1.1, 1.1, "gt")).toBe(false);
    expect(meetsThreshold(1.11, 1.1, "gt")).toBe(true);
  });

  it("supports lt and lte", () => {
    expect(meetsThreshold(0.9, 1.0, "lt")).toBe(true);
    expect(meetsThreshold(1.0, 1.0, "lt")).toBe(false);
    expect(meetsThreshold(1.0, 1.0, "lte")).toBe(true);
  });

  it("never crosses on an unknown comparator", () => {
    expect(meetsThreshold(9.9, 1.0, "≈")).toBe(false);
  });
});

describe("round2", () => {
  it("removes float artefacts", () => {
    expect(round2(0.23 - 0.1)).toBe(0.13);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("compareSources", () => {
  it("flags exactly the day the sources disagree about crossing", () => {
    const { splitDays, rows } = compareSources([OM, NASA], DATES, 150, "gte");
    expect(splitDays).toEqual(["2024-06-04"]);
    const day = rows.find((r) => r.date === "2024-06-04");
    expect(day?.verdict).toBe("split");
    expect(day?.incomplete).toBe(false);
  });

  it("reports the spread on the disagreement day", () => {
    const { rows } = compareSources([OM, NASA], DATES, 150, "gte");
    expect(rows.find((r) => r.date === "2024-06-04")?.spread).toBe(0.93);
    expect(rows.find((r) => r.date === "2024-06-01")?.spread).toBe(0.13);
  });

  it("says neither crosses when the threshold is above both sources", () => {
    const { splitDays, rows } = compareSources([OM, NASA], DATES, 250, "gte");
    expect(splitDays).toEqual([]);
    expect(rows.every((r) => r.verdict === "neither")).toBe(true);
  });

  it("detects agreement days on both sides of the threshold", () => {
    const { splitDays, rows } = compareSources([OM, NASA], DATES, 20, "gte");
    expect(splitDays).toEqual(["2024-06-01", "2024-06-02"]);
    expect(rows.find((r) => r.date === "2024-06-04")?.verdict).toBe("both");
    expect(rows.find((r) => r.date === "2024-06-03")?.verdict).toBe("neither");
  });

  it("marks a day a source is missing without inventing a reading", () => {
    const omGap = { ...OM, daily: { ...OM.daily, "2024-06-05": null } };
    const { rows } = compareSources([omGap, NASA], DATES, 150, "gte");
    const day = rows.find((r) => r.date === "2024-06-05");
    expect(day?.incomplete).toBe(true);
    expect(day?.verdict).toBe("single");
    expect(day?.spread).toBeNull();
    expect(day?.readings.find((r) => r.sourceId === OM.sourceId)?.value).toBeNull();
  });

  it("reports a day missing from every source as none", () => {
    const a = { ...OM, daily: { ...OM.daily, "2024-06-05": null } };
    const b = { ...NASA, daily: { ...NASA.daily, "2024-06-05": null } };
    const { rows } = compareSources([a, b], DATES, 150, "gte");
    const day = rows.find((r) => r.date === "2024-06-05");
    expect(day?.verdict).toBe("none");
    expect(day?.incomplete).toBe(true);
  });

  it("handles a single series and an empty series list", () => {
    expect(compareSources([OM], DATES, 150, "gte").rows.every((r) => r.verdict === "single")).toBe(true);
    const none = compareSources([], DATES, 150, "gte");
    expect(none.rows.every((r) => r.verdict === "none")).toBe(true);
    expect(none.splitDays).toEqual([]);
  });
});

describe("perSourceVerdicts", () => {
  it("computes what each single source would force under max_single", () => {
    const out = perSourceVerdicts([OM, NASA], DATES, "max_single", 150, "gte");
    expect(out).not.toBeNull();
    expect(out).toEqual([
      expect.objectContaining({ sourceId: OM.sourceId, aggregate: 1.1, crosses: false, daysCovered: 5 }),
      expect.objectContaining({ sourceId: NASA.sourceId, aggregate: 2.03, crosses: true, daysCovered: 5 }),
    ]);
  });

  it("computes the cumulative aggregate per source", () => {
    const out = perSourceVerdicts([OM, NASA], DATES, "cumulative", 150, "gte");
    expect(out?.[0].aggregate).toBe(1.4);
    expect(out?.[1].aggregate).toBe(2.53);
    expect(out?.[0].crosses).toBe(false);
    expect(out?.[1].crosses).toBe(true);
  });

  it("respects the exact threshold boundary (gte)", () => {
    const out = perSourceVerdicts([OM], DATES, "max_single", 110, "gte");
    expect(out?.[0].aggregate).toBe(1.1);
    expect(out?.[0].crosses).toBe(true);
  });

  it("returns null for aggregations it does not compute", () => {
    expect(perSourceVerdicts([OM, NASA], DATES, "consecutive_days", 150, "gte")).toBeNull();
  });

  it("only aggregates over the days it was given", () => {
    const out = perSourceVerdicts([OM], ["2024-06-01", "2024-06-02"], "max_single", 150, "gte");
    expect(out?.[0].aggregate).toBe(0.2);
    expect(out?.[0].daysCovered).toBe(2);
  });

  it("reports a source with no readings as not crossing, with zero days", () => {
    const empty = { sourceId: "x", label: "X", daily: {} as Record<string, number | null> };
    const out = perSourceVerdicts([empty], DATES, "cumulative", 150, "gte");
    expect(out?.[0]).toEqual({
      sourceId: "x",
      label: "X",
      aggregate: 0,
      crosses: false,
      daysCovered: 0,
    });
  });
});
