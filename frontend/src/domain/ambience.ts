/**
 * Timing, envelope and gain values for the hero's synthesised weather audio.
 *
 * WHY THESE NUMBERS LIVE HERE: audio graphs cannot be heard by CI, but their
 * numbers can be asserted. The clap cadence is a pure function and is pinned by
 * a test; the same applies to the thunder envelope, the wind sweep and the layer
 * gains. So a mistuned constant fails the suite instead of shipping unnoticed.
 *
 * WHY SYNTHESISED, NOT RECORDED: a rain recording is an audio asset with its
 * own licensing and a few hundred kB to download. Filtered noise plus a sub-bass
 * roll makes a convincing storm in a few lines, with nothing to fetch and
 * nothing to attribute.
 */

/** Milliseconds until the next thunder clap: soon when first, sparse after. */
export function thunderDelayMs(
  random: () => number = Math.random,
  first: boolean = false,
): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return first ? 2500 + r * 2500 : 9000 + r * 13000;
}

/**
 * Full period of one wind gust cycle, in milliseconds.
 *
 * Slow on purpose. Wind that gusts faster than a few seconds reads as noise
 * modulation rather than weather, and rapid amplitude movement is fatiguing.
 */
export function windGustMs(random: () => number = Math.random): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return 9000 + r * 14000;
}

/** The thunder envelope: how loud, how long, and where the roll sits. */
export interface ThunderShape {
  /** Peak gain of the noise burst. */
  peak: number;
  /** Peak gain of the sub-bass roll under it. */
  rumblePeak: number;
  /** Total length of the burst before it is stopped, in seconds. */
  seconds: number;
  /** Low-pass cutoff at the crack, in Hz. */
  openHz: number;
  /** Low-pass cutoff once it has rolled away, in Hz. */
  closedHz: number;
  /** Sub-bass frequency at the start, Hz. */
  rumbleHz: number;
  /**
   * Delay before the second, quieter roll, in seconds. This is what makes
   * thunder sound distant: the return off a far ridge arrives late and duller.
   */
  echoDelay: number;
  /** Gain of the delayed roll relative to the first. */
  echoGain: number;
}

/**
 * A thunder clap, randomised so repeats never sound looped.
 *
 * Values are widened from the first implementation: a longer tail, a lower
 * floor, and a delayed echo. The original read as a short "thump"; the longer
 * decay plus the echo is what makes it read as a storm at distance.
 */
export function thunderShape(random: () => number = Math.random): ThunderShape {
  const r = () => Math.min(Math.max(random(), 0), 1);
  return {
    peak: 0.22 + r() * 0.12,
    rumblePeak: 0.11 + r() * 0.06,
    seconds: 3.4 + r() * 1.8,
    openHz: 200 + r() * 160,
    closedHz: 52 + r() * 26,
    rumbleHz: 48 + r() * 16,
    // 0.28-0.75s: far enough to be a distinct return, near enough to still be
    // one event rather than two.
    echoDelay: 0.28 + r() * 0.47,
    echoGain: 0.34 + r() * 0.22,
  };
}

/**
 * Per-layer gains, documented so the mix can be reasoned about.
 *
 * The ordering is the contract: rain sits UNDER the reader, wind is felt rather
 * than heard, and thunder is the only layer allowed to be loud. `thunder` being
 * the peak is asserted in the test, because a storm where the background is
 * louder than the clap sounds wrong immediately.
 */
export const AMB_GAINS = {
  /** The near rain hiss the user is nominally "standing in". */
  rain: 0.05,
  /** A duller, quieter layer behind it, which is what adds depth. */
  rainFar: 0.022,
  /** Wind. Deliberately the quietest: it should be felt, not noticed. */
  wind: 0.05,
  /** A very low bed that gives the storm weight under everything. */
  bed: 0.035,
  /** The clap. The only layer allowed to be prominent. */
  thunder: 0.34,
} as const;

/** Band-pass sweep range for the wind, in Hz. */
export const WIND_BAND = { low: 220, high: 900, q: 1.6 } as const;