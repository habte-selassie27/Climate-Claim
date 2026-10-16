/**
 * Layout maths for the 3D evidence chart.
 *
 * Same contract as `fieldLayout.ts` for the hero scene: the component is not
 * allowed to invent its own numbers. A column's height is linear in the
 * reading, a recorded 0 still draws a hairline (visible, so "measured zero"
 * and "no data" never look alike), and `null` draws no column at all.
 *
 * Pure functions, pinned by direct tests, so those facts are checkable
 * without a browser or a canvas.
 */

/** Shortest column drawn. A recorded 0 gets this, so "zero" is visible. */
export const MIN_COLUMN = 0.04;

/**
 * Horizontal distance between day groups. Wide weeks spread out; long periods
 * compress toward a floor so 30 days still fit one frame.
 */
export function spacingFor(dayCount: number): number {
  if (dayCount <= 1) return 1.35;
  return Math.min(1.35, Math.max(0.5, 12 / dayCount));
}

/**
 * Column height in world units for one reading.
 * `null` means the source returned nothing that day: draw no column.
 */
export function columnHeight(
  value: number | null | undefined,
  axisTop: number,
  chartHeight: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (axisTop <= 0) return MIN_COLUMN;
  return Math.max((value / axisTop) * chartHeight, MIN_COLUMN);
}

/**
 * Sideways offset of one source's column inside a day group, centred on the
 * day: two sources sit at -w/2 and +w/2, three at -w, 0, +w.
 */
export function sourceOffsetX(index: number, count: number, width: number): number {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * width;
}

/**
 * Stagger before a column starts to grow, milliseconds. Day-major so the
 * period sweeps left to right; the per-day step shrinks with the period so a
 * month still finishes in roughly a second and a half.
 */
export function revealDelayMs(
  dayIndex: number,
  seriesIndex: number,
  dayCount: number,
): number {
  const step = Math.min(90, 1400 / Math.max(1, dayCount));
  return Math.round(dayIndex * step + seriesIndex * 45);
}
