/**
 * One storm clock, shared by the light and the sound.
 *
 * WHY THIS EXISTS: the lightning and the thunder previously ran on two
 * independent random timers that happened to share a range (9-22s). Two
 * independent draws from the same range are uncorrelated, so a clap almost
 * never landed under a bolt and a bolt almost never had thunder under it. The
 * storm read as two unrelated effects happening on the same page.
 *
 * A shared clock fixes that, and it buys the one thing that makes lightning
 * feel like lightning: ORDER. You see the strike first and hear it after,
 * because light is instant and sound is not. The gap is derived from the
 * strike's distance at 343 m/s, so a near strike cracks almost immediately and
 * a far one rolls in late and dull. Distance is mostly timing.
 *
 * NOTHING HERE IS AUDIO. This module has no Web Audio dependency, so it can be
 * unit tested with fake timers, which is the same discipline the clap cadence
 * uses (see the note in `ambience.ts`).
 */

import { thunderDelayMs } from "./ambience";

/** Speed of sound in dry air at ~20C, metres per second. */
const SPEED_OF_SOUND = 343;

export interface Strike {
  /** Monotonic strike index. Doubles as the bolt generator's seed. */
  index: number;
  /**
   * Ground distance to the strike in metres.
   *
   * Not decoration: it sets how far behind the flash the thunder arrives, and
   * how long the roll lasts. A strike chosen at random that does not move the
   * sound by any amount is the same strike with extra steps.
   */
  distanceM: number;
}

/**
 * Distance to a strike, 180-1800m.
 *
 * The near end cracks almost on top of the flash; the far end arrives several
 * seconds later. The ceiling is deliberate: past ~1.8km the delay stops reading
 * as distance and starts reading as the sound belonging to something else, and
 * the hero is a page, not a simulation.
 */
export function strikeDistanceM(random: () => number = Math.random): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return 180 + r * 1620;
}

/**
 * How long after the flash the thunder is heard: distance / speed of sound.
 *
 * Clamped low only by physics -- a strike at 0m is heard with no delay, which
 * is correct. The upper bound is not arbitrary: at 1800m this returns ~5.2s,
 * which is already at the edge of feeling connected to the flash.
 */
export function audioDelayMs(distanceM: number): number {
  return (Math.max(distanceM, 0) / SPEED_OF_SOUND) * 1000;
}

export interface StormClock {
  /**
   * Register a listener. The clock starts on the first subscriber and stops
   * when the last one leaves, so StrictMode's double-mount does not leave a
   * timer running and there is nothing to clean up by hand at a call site.
   */
  subscribe(fn: (strike: Strike) => void): () => void;
  /** True while at least one listener is attached. */
  readonly running: boolean;
}

/** Injected so the clock can be driven by fake timers in tests. */
export interface ClockDeps {
  random?: () => number;
  /** Delay until the next strike. Defaults to the existing clap cadence. */
  delayMs?: (random: () => number, first: boolean) => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export function createStormClock(deps: ClockDeps = {}): StormClock {
  const random = deps.random ?? Math.random;
  const delay = deps.delayMs ?? thunderDelayMs;
  // globalThis, not window: the clock is a pure module with no DOM dependency,
  // so it can be driven under fake timers in a node environment. The handle is
  // cast because node returns an object and the DOM lib types it as a number --
  // it is passed back to clearTimeout unchanged, so the cast is inert.
  const setTimer =
    deps.setTimer ??
    ((fn: () => void, ms: number) =>
      globalThis.setTimeout(fn, ms) as unknown as number);
  const clearTimer =
    deps.clearTimer ??
    ((id: number) => globalThis.clearTimeout(id as unknown as number));

  const listeners = new Set<(strike: Strike) => void>();
  let timer = 0;
  let index = 0;

  const tick = (first: boolean) => {
    if (listeners.size === 0) return;
    const ms = delay(random, first);
    timer = setTimer(() => {
      // Re-checked after the await: every listener may have unsubscribed while
      // the timer was pending, and rescheduling then would leak a timer nobody
      // is listening to.
      if (listeners.size === 0) return;
      const strike: Strike = { index: index++, distanceM: strikeDistanceM(random) };
      // Copied, because a listener is allowed to unsubscribe from inside its
      // own callback and mutating the set mid-iteration would skip the next one.
      for (const fn of [...listeners]) fn(strike);
      tick(false);
    }, ms);
  };

  return {
    subscribe(fn) {
      const wasIdle = listeners.size === 0;
      listeners.add(fn);
      if (wasIdle) tick(true);
      return () => {
        listeners.delete(fn);
        if (listeners.size === 0 && timer !== 0) {
          clearTimer(timer);
          timer = 0;
        }
      };
    },
    get running() {
      return listeners.size > 0;
    },
  };
}

/**
 * The clock the hero actually uses.
 *
 * A module singleton rather than context because both consumers are siblings on
 * one route, and a singleton cannot be rendered without its provider -- a
 * missing provider would be a runtime crash rather than a fallback.
 */
export const stormClock = createStormClock();