import { describe, expect, it } from "vitest";
import { lightningStrike } from "./ambience";

/**
 * The bolt is drawn from a seeded generator, so these assertions pin the
 * invariants that make it read as lightning rather than as a random scribble:
 * it must start at the top, reach the ground, and fork.
 */
function numbers(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

describe("lightningStrike", () => {
  it("starts at the top edge and reaches the ground", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const s = lightningStrike(seed);
      const n = numbers(s.main);
      const ys = n.filter((_, i) => i % 2 === 1);
      expect(Math.min(...ys), `seed ${seed} never starts at the top`).toBeLessThanOrEqual(0.01);
      expect(Math.max(...ys), `seed ${seed} never reaches the ground`).toBeGreaterThan(40);
    }
  });

  it("stays inside the box", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const s = lightningStrike(seed);
      for (const d of [s.main, ...s.branches]) {
        const n = numbers(d);
        const xs = n.filter((_, i) => i % 2 === 0);
        const ys = n.filter((_, i) => i % 2 === 1);
        for (const x of xs) expect(Math.abs(x), `seed ${seed} x out of bounds`).toBeLessThanOrEqual(100);
        for (const y of ys) expect(y, `seed ${seed} y out of bounds`).toBeGreaterThanOrEqual(-1);
      }
    }
  });

  it("forks at least twice, every strike", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(lightningStrike(seed).branches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("is jagged rather than straight", () => {
    // A straight line is not lightning. Require the channel to change direction
    // horizontally more than once.
    for (let seed = 0; seed < 20; seed += 1) {
      const xs = numbers(lightningStrike(seed).main).filter((_, i) => i % 2 === 0);
      let reversals = 0;
      for (let i = 2; i < xs.length; i += 1) {
        const a = xs[i - 1]! - xs[i - 2]!;
        const b = xs[i]! - xs[i - 1]!;
        if (a * b < 0) reversals += 1;
      }
      expect(reversals, `seed ${seed} is too straight`).toBeGreaterThan(0);
    }
  });

  it("differs between consecutive strikes, so it does not read as a loop", () => {
    for (let seed = 1; seed < 10; seed += 1) {
      expect(lightningStrike(seed).main).not.toBe(lightningStrike(seed - 1).main);
    }
  });

  it("is deterministic for a given seed, so a strike is reproducible", () => {
    expect(lightningStrike(7)).toEqual(lightningStrike(7));
  });

  it("varies its placement across strikes", () => {
    const xs = new Set(Array.from({ length: 20 }, (_, i) => lightningStrike(i).x.toFixed(1)));
    // A bolt always in the same place would look like a fixed ornament.
    expect(xs.size).toBeGreaterThan(10);
  });
});