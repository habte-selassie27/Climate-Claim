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
 * REVISED after feedback that the storm needed to be audible: the wind is now
 * the most prominent continuous layer, not the quietest. The ordering below is
 * the contract, and the test asserts it:
 *
 *   thunder > wind > bed > rain > rainFar
 *
 * Thunder peaks because it is an event; wind is next because the request was for
 * a loud, voiced wind; the rain layers stay under reading level so the page
 * remains usable while the ambience plays.
 */
export const AMB_GAINS = {
  /** The near rain hiss. Kept low: this runs under everything, continuously. */
  rain: 0.05,
  /** A duller, quieter layer behind it, which is what adds depth. */
  rainFar: 0.022,
  /** Wind. Prominent, as requested -- but still below a thunder clap. */
  wind: 0.13,
  /** A very low bed that gives the storm weight under everything. */
  bed: 0.07,
  /** The clap. The loudest thing in the mix. */
  thunder: 0.38,
} as const;

/**
 * Band-pass range for the wind.
 *
 * `q` is raised well above the previous 1.6 and the range dropped: a narrow,
 * highly resonant band sweeping slowly gives wind a *voiced*, hollow quality
 * instead of plain hiss. Too high a Q and it whistles rather than howls.
 */
export const WIND_BAND = { low: 160, high: 640, q: 5.5 } as const;

/**
 * Sidechain duck: how far the continuous layers drop while a clap sounds.
 *
 * WHY: rain, wind and bed are continuous beds, so an un-ducked clap is masked by
 * them and reads as a thump *inside* the storm rather than cutting through it.
 * Dipping the beds briefly is how a mixer makes an event audible over a bed --
 * and it is perceptually correct, because a loud source does mask what is behind
 * it.
 */
export const DUCK = {
  /** Fraction of the beds' gain remaining at the deepest point. */
  depth: 0.42,
  /** How fast the duck engages, seconds. Fast, or the clap loses its punch. */
  attack: 0.06,
  /** How long it holds before releasing, seconds. */
  hold: 0.5,
  /** How slowly it recovers, seconds. Recovery must be slower than attack. */
  release: 2.6,
} as const;

/**
 * Rain streak width in PIXELS.
 *
 * Needed because `LineBasicMaterial.linewidth` is ignored by every WebGL
 * implementation -- it is not a hint, it is a no-op -- so real width needs
 * `LineSegments2` from three's addons, which expands each segment into a quad.
 */
export const RAIN_WIDTH = { px: 2.4 } as const;
/**
 * A forked lightning bolt, as an SVG path plus the strike's placement.
 *
 * WHY GENERATED RATHER THAN DRAWN: a hand-authored bolt would repeat identically
 * every strike, which reads as a loop. Real lightning forks irregularly, so the
 * path is built from a seeded pseudo-random walk that always starts at the top,
 * always reaches the ground, and always branches downward-outward.
 *
 * The seed is the strike index, so a given strike is reproducible in a test but
 * differs from the one before it on screen.
 */
export interface Strike {
  /** `d` for the main channel, drawn as the bright core. */
  main: string;
  /** `d` for each branch, drawn dimmer and thinner. */
  branches: string[];
  /** Strike origin, as a percentage of the overlay box. */
  x: number;
  /** Ground point, as a percentage of the overlay height. */
  y: number;
  /** Horizontal lean of the whole channel, in percent. */
  lean: number;
}

/** Deterministic 0..1 from an integer seed; mulberry32. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build one strike in a 100x100 box, so the caller can scale it to any size. */
export function lightningStrike(seed: number): Strike {
  const rand = seeded(seed);
  const x = 12 + rand() * 76;
  const lean = (rand() - 0.5) * 34;
  const y = 42 + rand() * 48;

  // Main channel: a jagged descent, jitter shrinking toward the ground so it
  // converges instead of wandering off the box.
  const steps = 7 + Math.floor(rand() * 4);
  const main: string[] = [];
  let cx = x;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const jitter = (rand() - 0.5) * 22 * (1 - t * 0.65);
    // Jitter accumulates, so without a clamp the channel walks off the side of
    // the box after a few steps.
    cx = Math.min(Math.max(cx + jitter, 4), 96);
    const px = cx;
    const py = t * y;
    main.push(`${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`);
  }

  // Branches peel off the channel partway down and fall away from it.
  const branches: string[] = [];
  const count = 2 + Math.floor(rand() * 3);
  for (let b = 0; b < count; b += 1) {
    const segs = 2 + Math.floor(rand() * 3);
    const dir = rand() < 0.5 ? -1 : 1;
    const seg: string[] = [];
    let bx = x + lean * 0.4;
    let by = y * (0.25 + rand() * 0.5);
    for (let i = 0; i <= segs; i += 1) {
      bx = Math.min(Math.max(bx + dir * (3 + rand() * 5), 3), 97);
      by += 6 + rand() * 7;
      seg.push(`${i === 0 ? "M" : "L"}${bx.toFixed(2)},${by.toFixed(2)}`);
    }
    branches.push(seg.join(" "));
  }

  return { main: main.join(" "), branches, x, y, lean };
}
