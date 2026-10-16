import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Regression guard for the reported bug: "on the light mode the rain drops are
 * not visible".
 *
 * THE TRAP: the rain is painted into WebGL, so it cannot read a CSS custom
 * property, and its colour is composited at partial opacity over whatever is
 * behind it. Checking the raw hex against the page therefore proves nothing --
 * alpha blending pulls the result toward the background, and a pale blue at 0.28
 * over near-white can look reasonable as a hex and still be invisible.
 *
 * So these tests composite the real value over each theme's real page colour and
 * measure the RESULT. That is what the eye actually sees.
 */

const css = readFileSync(
  fileURLToPath(new URL("../styles/global.css", import.meta.url)),
  "utf8",
);
const fieldSrc = readFileSync(
  fileURLToPath(new URL("../components/PrecipitationField.tsx", import.meta.url)),
  "utf8",
);

const soundSrc = readFileSync(
  fileURLToPath(new URL("../components/WeatherSound.tsx", import.meta.url)),
  "utf8",
);

/** The one place a strike cadence is allowed to exist. */
const cadenceSrc = readFileSync(
  fileURLToPath(new URL("../domain/ambience.ts", import.meta.url)),
  "utf8",
);

// --- colour maths ------------------------------------------------------------

function luminance(rgb: number[]): number {
  const f = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(rgb[0]!) + 0.7152 * f(rgb[1]!) + 0.0722 * f(rgb[2]!);
}

function contrast(a: number[], b: number[]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

function hex(value: string): number[] {
  const h = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Composite `fg` at `alpha` over `bg`, which is what the eye sees. */
function composite(fg: number[], bg: number[], alpha: number): number[] {
  return fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha));
}

/** The palette block out of the component source. */
function rainPalette(theme: "light" | "dark"): { a: number[]; b: number[] } {
  const block = new RegExp(`${theme}:\\s*\\{([^}]*)\\}`).exec(fieldSrc)?.[1] ?? "";
  const pick = (key: string) => {
    const m = new RegExp(`${key}:\\s*"(#[0-9a-fA-F]{6})"`).exec(block)?.[1];
    expect(m, `${theme}.${key} must be a hex literal`).toBeTruthy();
    return hex(m!);
  };
  return { a: pick("a"), b: pick("b") };
}

// Stripped so the source check below cannot be satisfied by a comment that
// merely mentions AdditiveBlending when explaining why it is avoided.
const fieldCode = fieldSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const OPACITY_FLOOR = 0.75;

describe("rain visibility per theme", () => {
  it("light streaks clear 3:1 composited on the light page", () => {
    // #edf1f3 -- the light --gauge-paper the rain sits on.
    const bg = hex("#edf1f3");
    for (const [name, colour] of Object.entries(rainPalette("light"))) {
      const ratio = contrast(composite(colour, bg, OPACITY_FLOOR), bg);
      expect(
        ratio,
        `light series ${name} composites to only ${ratio.toFixed(2)}:1 on #edf1f3`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("dark streaks clear 3:1 composited on the dark page", () => {
    const bg = hex("#0b1016");
    for (const [name, colour] of Object.entries(rainPalette("dark"))) {
      const ratio = contrast(composite(colour, bg, OPACITY_FLOOR), bg);
      expect(
        ratio,
        `dark series ${name} composites to only ${ratio.toFixed(2)}:1 on #0b1016`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the two sources distinguishable after compositing", () => {
    // The lighter source must not be invisible against the page just because
    // the darker one is heavy. This is the failure the original palette had.
    for (const theme of ["light", "dark"] as const) {
      const bg = hex(theme === "light" ? "#edf1f3" : "#0b1016");
      const { a, b } = rainPalette(theme);
      const sep = contrast(composite(a, bg, OPACITY_FLOOR), composite(b, bg, OPACITY_FLOOR));
      expect(sep, `${theme}: the two sources are indistinguishable`).toBeGreaterThan(1.15);
    }
  });

  it("uses different palettes per theme rather than one shared value", () => {
    const light = rainPalette("light");
    const dark = rainPalette("dark");
    // A pale-on-dark / dark-on-light swap means the two differ in luminance.
    expect(luminance(light.a)).toBeLessThan(luminance(dark.a));
  });

  it("never falls back to additive blending", () => {
    // Additive is invisible on a light page: adding to near-white clips.
    expect(fieldCode).not.toMatch(/AdditiveBlending/);
  });
});

describe("lightning flash", () => {
  it("is defined as a two-strike animation, not a single fade", () => {
    const kf = /@keyframes precip-flash\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    // Two distinct peaks: one bright, one weaker and later.
    expect(kf).toMatch(/opacity:\s*0\.55/);
    expect(kf).toMatch(/opacity:\s*0\.34/);
    expect(kf).toMatch(/100%\s*\{\s*opacity:\s*0/);
  });

  it("settles fully transparent so it cannot persist as a bright overlay", () => {
    expect(/\.precip-flash\s*\{[^}]*opacity:\s*0/.test(css)).toBe(true);
  });

  it("is fully disabled under prefers-reduced-motion", () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{\s*\.precip-flash\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(block).toBeTruthy();
    expect(block).toMatch(/animation:\s*none/);
    expect(block).toMatch(/opacity:\s*0/);
  });

  /**
   * Repointed from the component to `ambience.ts` when the flash schedule moved
   * onto the shared storm clock. The old assertion scraped the literal
   * `9000 + Math.random() * 13000` out of PrecipitationField.tsx and FAILED when
   * it was moved -- which is the point: the cadence cannot quietly vanish or be
   * re-tuned in one of two places without a test noticing.
   */
  it("is scheduled sparsely, not as a strobe", () => {
    // The STEADY-STATE arm, not the opening one: thunderDelayMs branches on
    // `first`, and the opening strike is deliberately sooner (~2.5-5s) because a
    // page that waits 9s to show anything reads as broken. It is a single
    // one-off, so it is not what this guard is about.
    const m = /:\s*(\d{4,})\s*\+\s*r\s*\*\s*(\d+)/.exec(cadenceSrc);
    expect(m).not.toBeNull();
    // A flash more often than this is an accessibility hazard.
    expect(Number(m![1])).toBeGreaterThanOrEqual(8000);
  });

  it("opens sooner than the steady state, so the hero is not dead on arrival", () => {
    // `first` may be earlier than the steady state, but not so early the first
    // strike lands before the page has settled.
    const m = /\?\s*(\d{3,})\s*\+\s*r\s*\*\s*(\d+)/.exec(cadenceSrc);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(1000);
  });

  it("has exactly one cadence, shared by the light and the sound", () => {
    // Two schedules reading the same range are uncorrelated: a clap then lands
    // under no bolt, and a bolt under no clap. One owner is the fix.
    expect(fieldSrc).not.toMatch(/\d{4,}\s*\+\s*Math\.random\(\)/);
    expect(soundSrc).not.toMatch(/\d{4,}\s*\+\s*Math\.random\(\)/);
    expect(fieldSrc).toContain("stormClock.subscribe");
    expect(soundSrc).toContain("stormClock.subscribe");
  });

  it("puts the thunder after the flash, by the strike's distance", () => {
    // Light is instant and sound is not. If the clap were scheduled with zero
    // delay the storm would be wrong in a way people notice without being able
    // to say why.
    expect(soundSrc).toContain("audioDelayMs(strike.distanceM)");
  });
});