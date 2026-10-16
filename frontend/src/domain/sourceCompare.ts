/**
 * Per-day comparison of two or more evidence series, and the per-source
 * verdicts behind the "deterministic chain" contrast.
 *
 * These functions never invent a reading. A day a source did not return stays
 * null, days are classified from the values that exist, and a spread is only
 * reported when at least two sources actually returned a reading.
 *
 * They operate on a minimal structural type (SeriesLike) so the demo fixtures
 * and any future live series can both be passed without a shared import.
 */

export interface SeriesLike {
  sourceId: string;
  label: string;
  /** null = the source returned no reading for that day. Never filled in. */
  daily: Record<string, number | null>;
}

export interface SourceReading {
  sourceId: string;
  label: string;
  value: number | null;
  /** Whether this reading meets the comparator, or null when it is missing. */
  crosses: boolean | null;
}

export type DayVerdict =
  /** Two or more readings disagree about the comparator. */
  | "split"
  /** Every present reading meets the comparator. */
  | "both"
  /** No present reading meets the comparator. */
  | "neither"
  /** Only one source returned a reading that day. */
  | "single"
  /** No source returned a reading that day. */
  | "none";

export interface CompareRow {
  date: string;
  readings: SourceReading[];
  /** Highest minus lowest among present readings; null when fewer than two. */
  spread: number | null;
  verdict: DayVerdict;
  /** True when at least one source has no reading for this day. */
  incomplete: boolean;
}

export interface SourceComparison {
  rows: CompareRow[];
  /** Days where sources with readings disagree about the comparator. */
  splitDays: string[];
}

/** Round to the contract's 2-decimal scale, so float artefacts never leak. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function meetsThreshold(value: number, threshold: number, comparator: string): boolean {
  switch (comparator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

export function compareSources(
  series: SeriesLike[],
  dates: string[],
  thresholdScaled: number,
  comparator: string,
): SourceComparison {
  const threshold = thresholdScaled / 100;
  const rows: CompareRow[] = dates.map((date) => {
    const readings: SourceReading[] = series.map((s) => {
      const raw = s.daily[date];
      const value = typeof raw === "number" ? raw : null;
      return {
        sourceId: s.sourceId,
        label: s.label,
        value,
        crosses: value === null ? null : meetsThreshold(value, threshold, comparator),
      };
    });
    const present = readings.filter((r): r is SourceReading & { value: number } => r.value !== null);
    const values = present.map((r) => r.value);
    const spread = values.length >= 2 ? round2(Math.max(...values) - Math.min(...values)) : null;
    const flags = present.map((r) => r.crosses === true);
    let verdict: DayVerdict;
    if (present.length === 0) verdict = "none";
    else if (present.length === 1) verdict = "single";
    else if (flags.some((f) => f) && flags.some((f) => !f)) verdict = "split";
    else if (flags.every((f) => f)) verdict = "both";
    else verdict = "neither";
    return { date, readings, spread, verdict, incomplete: present.length < series.length };
  });
  return { rows, splitDays: rows.filter((r) => r.verdict === "split").map((r) => r.date) };
}

export interface SourceVerdict {
  sourceId: string;
  label: string;
  /** The aggregate this source alone would produce for the period. */
  aggregate: number;
  crosses: boolean;
  daysCovered: number;
}

/**
 * What each single source would force, if a contract were hard-wired to it:
 * the policy's aggregation computed over the days that source returned, then
 * compared with the threshold. Returns null for aggregations this module does
 * not compute (the UI then omits the contrast rather than guessing).
 */
export function perSourceVerdicts(
  series: SeriesLike[],
  dates: string[],
  aggregation: string,
  thresholdScaled: number,
  comparator: string,
): SourceVerdict[] | null {
  if (aggregation !== "max_single" && aggregation !== "cumulative") return null;
  const threshold = thresholdScaled / 100;
  return series.map((s) => {
    const values = dates
      .map((d) => s.daily[d])
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) {
      return { sourceId: s.sourceId, label: s.label, aggregate: 0, crosses: false, daysCovered: 0 };
    }
    const aggregate =
      aggregation === "max_single" ? round2(Math.max(...values)) : round2(values.reduce((a, b) => a + b, 0));
    return {
      sourceId: s.sourceId,
      label: s.label,
      aggregate,
      crosses: meetsThreshold(aggregate, threshold, comparator),
      daysCovered: values.length,
    };
  });
}
