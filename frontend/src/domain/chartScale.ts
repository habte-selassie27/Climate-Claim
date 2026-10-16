/**
 * Axis tick selection for the evidence chart.
 *
 * WHY THIS EXISTS: the chart used to place gridlines at fixed fractions
 * ([0, 0.25, 0.5, 0.75, 1]) of the axis maximum and label them with
 * `toFixed(1)`. For a 2.5 mm axis that produced 0.0 / 0.6 / 1.3 / 1.9 / 2.5 —
 * evenly spaced *lines* carrying unevenly spaced *numbers*, which misrepresents
 * the data: a reader sees unequal gaps where there are none.
 *
 * The fix is to choose a round STEP first and derive the top from it, so every
 * label is a multiple of the step and the numbers read evenly.
 *
 * Classic "nice numbers" (Hastings) approach: snap the raw step to 1, 2, 5 or 10
 * times a power of ten.
 */

/** Snap to 1, 2, 5 or 10 x a power of ten. */
function niceNumber(value: number, round: boolean): number {
  if (value <= 0 || !Number.isFinite(value)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let nice: number;
  if (round) {
    nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return nice * 10 ** exponent;
}

export interface Scale {
  /** Round step between gridlines. */
  step: number;
  /** Axis top: a multiple of `step` that is >= `valueMax`. */
  top: number;
  /** Every tick value from 0 to `top`, inclusive. */
  ticks: number[];
  /** True when one decimal is enough; otherwise two are used. */
  decimals: number;
}

/**
 * Build an even scale whose top covers `valueMax`.
 *
 * `targetTicks` is a hint, not a guarantee: a round step may produce one more or
 * one fewer gridline, which is the correct trade for round labels.
 */
export function niceScale(valueMax: number, targetTicks = 4): Scale {
  const max = Number.isFinite(valueMax) && valueMax > 0 ? valueMax : 1;
  const step = niceNumber(max / Math.max(1, targetTicks), true);
  const top = Math.max(step, Math.ceil(max / step) * step);

  const ticks: number[] = [];
  // Accumulate by index rather than repeated addition: 0.1 + 0.2 !== 0.3 in
  // binary floating point, and a drifting tick axis looks broken.
  const count = Math.round(top / step);
  for (let i = 0; i <= count; i += 1) {
    ticks.push(Number((i * step).toFixed(10)));
  }

  // Precision comes from the step's own decimal representation, not its
  // magnitude: a 0.5 step needs one decimal and a 2.5 step needs one decimal
  // too, whereas a magnitude rule would round 2.5 to "3".
  const stepText = String(step);
  const dot = stepText.indexOf(".");
  const decimals = dot === -1 ? 0 : Math.min(3, stepText.length - dot - 1);
  return { step, top, ticks, decimals };
}

/** Format a tick label with the scale's precision, avoiding "-0.0". */
export function formatTick(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return text === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : text;
}