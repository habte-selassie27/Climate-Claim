/**
 * Timing for the hero's synthesised weather audio.
 *
 * WHY THESE NUMBERS: the first clap arrives soon after the toggle is pressed,
 * so the button is audibly connected to an effect; later claps keep their
 * distance so the ambience stays "rain with occasional thunder" rather than a
 * storm loop. Pure and deterministic given a random source, so the behaviour
 * is pinned by a test instead of by ear.
 */

/** Milliseconds until the next thunder clap: soon when first, sparse after. */
export function thunderDelayMs(
  random: () => number = Math.random,
  first: boolean = false,
): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return first ? 2500 + r * 2500 : 9000 + r * 13000;
}
