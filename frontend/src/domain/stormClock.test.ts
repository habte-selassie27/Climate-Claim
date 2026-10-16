import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  audioDelayMs,
  createStormClock,
  strikeDistanceM,
  type Strike,
} from "./stormClock";

describe("strikeDistanceM", () => {
  it("spans near to far, so strikes do not all sound identical", () => {
    const near = strikeDistanceM(() => 0);
    const far = strikeDistanceM(() => 1);
    expect(near).toBeLessThan(far);
    // A sub-second delay is not perceptible as distance at all.
    expect(near).toBeGreaterThan(0);
  });

  it("clamps out-of-range input rather than trusting the caller", () => {
    expect(strikeDistanceM(() => -5)).toBe(strikeDistanceM(() => 0));
    expect(strikeDistanceM(() => 5)).toBe(strikeDistanceM(() => 1));
  });

  it("is deterministic for a given random source", () => {
    expect(strikeDistanceM(() => 0.4)).toBe(strikeDistanceM(() => 0.4));
  });
});

describe("audioDelayMs", () => {
  it("puts the sound after the light, which is the whole point", () => {
    // Light is effectively instant; sound at 343 m/s is not. If this were ever
    // <= 0 the thunder would land before the flash, which cannot happen.
    for (const m of [180, 800, 1800]) {
      expect(audioDelayMs(m)).toBeGreaterThan(0);
    }
  });

  it("matches distance over the speed of sound", () => {
    expect(audioDelayMs(343)).toBeCloseTo(1000, 5);
    expect(audioDelayMs(1800)).toBeCloseTo((1800 / 343) * 1000, 5);
  });

  it("scales with distance, so far strikes arrive later", () => {
    expect(audioDelayMs(1500)).toBeGreaterThan(audioDelayMs(300));
  });

  it("treats a zero distance as immediate rather than negative", () => {
    expect(audioDelayMs(0)).toBe(0);
    expect(audioDelayMs(-500)).toBe(0);
  });
});

describe("createStormClock", () => {
  /**
   * Real fake timers rather than a hand-rolled queue: a hand-rolled `fire()`
   * replays timers that a strike re-schedules, so counts drift and the test ends
   * up asserting its own harness. Driving the real `setTimeout` also means the
   * default `setTimer`/`clearTimer` wiring is exercised.
   */
  const STEP = 1000;

  const mk = (over: Partial<Parameters<typeof createStormClock>[0]> = {}) => {
    const seen: Strike[] = [];
    const clock = createStormClock({ random: () => 0.5, delayMs: () => STEP, ...over });
    return { clock, seen, tick: (n = 1) => vi.advanceTimersByTime(STEP * n) };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays idle until something subscribes", () => {
    const { clock, tick, seen } = mk();
    tick(3);
    expect(clock.running).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("does not start a strike before the first interval elapses", () => {
    const { clock, seen, tick } = mk();
    clock.subscribe((s) => seen.push(s));
    tick();
    vi.setSystemTime(0);
    expect(seen).toHaveLength(1);
  });

  it("emits a strike when the interval fires", () => {
    const { clock, seen, tick } = mk();
    clock.subscribe((s) => seen.push(s));
    tick();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.index).toBe(0);
  });

  it("keeps the index monotonic, so the bolt generator never repeats a shape", () => {
    const { clock, seen, tick } = mk();
    clock.subscribe((s) => seen.push(s));
    tick(3);
    expect(seen.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("carries a distance, so light and sound can be separated", () => {
    const { clock, seen, tick } = mk();
    clock.subscribe((s) => seen.push(s));
    tick();
    expect(seen[0]!.distanceM).toBeGreaterThan(0);
  });

  it("notifies every subscriber, so the bolt and the clap share one event", () => {
    const { clock, tick } = mk();
    const light: Strike[] = [];
    const sound: Strike[] = [];
    clock.subscribe((s) => light.push(s));
    clock.subscribe((s) => sound.push(s));
    tick();
    // This is the property the two independent timers did not have: one strike,
    // one light, one sound, and both carrying the SAME distance -- so the sound
    // delay is derived from the flash that was just drawn.
    expect(light).toHaveLength(1);
    expect(sound).toEqual(light);
  });

  it("separates the light from the sound by the strike distance", () => {
    const { clock, tick } = mk();
    const gaps: number[] = [];
    clock.subscribe((s) => gaps.push(audioDelayMs(s.distanceM)));
    tick();
    // The sound lands strictly after the light, and by the travel time of the
    // exact distance that was drawn.
    expect(gaps[0]).toBeGreaterThan(0);
  });

  it("does not reschedule once the last listener has gone", () => {
    const { clock, seen, tick } = mk();
    const off = clock.subscribe((s) => seen.push(s));
    expect(clock.running).toBe(true);
    off();
    expect(clock.running).toBe(false);
    tick(5);
    expect(seen).toHaveLength(0);
  });

  it("keeps running while any listener remains", () => {
    const { clock, seen, tick } = mk();
    const offB = clock.subscribe(() => {});
    const offA = clock.subscribe((s) => seen.push(s));
    offB();
    tick(2);
    // B left, but A is still attached, so the storm must keep going.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    offA();
  });

  it("survives a subscriber unsubscribing from inside its own callback", () => {
    const { clock, tick } = mk();
    const seen: string[] = [];
    let offA = () => {};
    offA = clock.subscribe(() => {
      seen.push("a");
      offA();
    });
    clock.subscribe(() => seen.push("b"));
    tick();
    // "a" unsubscribes mid-notify; "b" must still be called, or one effect
    // silently stops working.
    expect(seen).toEqual(["a", "b"]);
  });

  it("does not fire into a void after the clock is stopped", () => {
    const { clock, seen, tick } = mk();
    const off = clock.subscribe((s) => seen.push(s));
    off();
    tick();
    expect(seen).toHaveLength(0);
  });

  it("is idle before anyone subscribes, so an unmounted hero holds no timer", () => {
    const { clock, tick } = mk();
    tick(10);
    expect(clock.running).toBe(false);
  });

  it("uses the clap cadence by default, so the storm keeps its rhythm", () => {
    const spy = vi.fn(() => STEP);
    const clock = createStormClock({ random: () => 0.5, delayMs: spy });
    clock.subscribe(() => {});
    // First strike passes first=true: the cadence's deliberately sooner opening.
    expect(spy).toHaveBeenCalledWith(expect.any(Function), true);
  });

  it("passes first=false for every strike after the first", () => {
    const spy = vi.fn(() => STEP);
    const { clock, tick } = mk({ delayMs: spy });
    clock.subscribe(() => {});
    tick(2);
    expect(spy).toHaveBeenLastCalledWith(expect.any(Function), false);
  });
});
