/**
 * Layout maths (and day labels) for the hero evidence field, the Three.js
 * scene ported from the supplied mock.
 *
 * WHY THIS IS SEPARATE FROM THE COMPONENT: the scene claims to draw the same
 * recorded readings as the chart and tables, and two facts about it must hold
 * no matter what the canvas does:
 *
 *   1. A bar's height is linear in the reading: `value x FIELD_SCALE`, with a
 *      visible minimum so a recorded 0.0 still reads as measured. A day a
 *      source did not return gets NO bar (`null`) -- a missing reading and a
 *      zero reading mean different things and must not be drawn the same way.
 *   2. The halo may only sit on a day `compareSources()` classifies as split,
 *      so the scene cannot invent a disagreement to decorate with.
 *
 * Pure functions, pinned by direct tests, so these two facts are checkable
 * without a browser or a canvas.
 */

/** World units per mm (the mock's value). */
export const FIELD_SCALE = 1.2;

/** Shortest bar drawn. A recorded 0 gets this, so "zero" is still visible. */
export const MIN_BAR = 0.03;

/** Horizontal distance between consecutive days, in world units. */
export const DAY_SPACING = 1.5;

/**
 * Bar height for one reading. `null` means the source returned nothing that
 * day and the scene draws no bar at all.
 */
export function barHeight(
  value: number | null | undefined,
  scale: number = FIELD_SCALE,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(value * scale, MIN_BAR);
}

/** X position of day `index` in a `count`-day row, centred on 0. */
export function dayX(index: number, count: number, spacing: number = DAY_SPACING): number {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * spacing;
}

/**
 * Index of the first split day that lies inside `dates`, or -1. The scene
 * draws its halo here and nowhere else; -1 means no halo is drawn.
 */
export function disagreementIndex(splitDays: string[], dates: string[]): number {
  for (const day of splitDays) {
    const index = dates.indexOf(day);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * "2024-06-04" -> "Jun 4" in the active locale (the mock's tip treatment).
 * Midday UTC is used so no timezone can shift the date across a boundary, and
 * an unusable input falls back to the raw string rather than "Invalid Date".
 */
export function dayLabel(date: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}
