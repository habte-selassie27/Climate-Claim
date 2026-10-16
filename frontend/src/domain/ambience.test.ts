import { describe, expect, it } from "vitest";
import {
  AMB_GAINS,
  DUCK,
  RAIN_WIDTH,
  WIND_BAND,
  thunderDelayMs,
  thunderShape,
  windGustMs,
} from "./ambience";

describe("thunderDelayMs", () => {
  it("brings the first clap in soon so the button is audibly connected", () => {
    for (const r of [0, 0.5, 1]) {
      const ms = thunderDelayMs(() => r, true);
      expect(ms).toBeGreaterThanOrEqual(2500);
      expect(ms).toBeLessThanOrEqual(5000);
    }
  });

  it("keeps later claps sparse, so it reads as rain with occasional thunder", () => {
    for (const r of [0, 0.5, 1]) {
      const ms = thunderDelayMs(() => r, false);
      expect(ms).toBeGreaterThanOrEqual(9000);
      expect(ms).toBeLessThanOrEqual(22000);
    }
  });

  it("clamps a misbehaving random source", () => {
    expect(thunderDelayMs(() => -5, false)).toBe(9000);
    expect(thunderDelayMs(() => 42, false)).toBe(22000);
  });
});

describe("windGustMs", () => {
  it("gusts slowly enough to read as weather, not as a tremolo", () => {
    for (const r of [0, 0.5, 1]) {
      expect(windGustMs(() => r)).toBeGreaterThanOrEqual(9000);
    }
  });

  it("varies, so the wind never loops audibly", () => {
    expect(windGustMs(() => 0)).not.toBe(windGustMs(() => 1));
  });
});

describe("thunderShape", () => {
  it("produces a longer, deeper tail than the original short thump", () => {
    for (const r of [0, 0.5, 1]) {
      const s = thunderShape(() => r);
      expect(s.seconds).toBeGreaterThanOrEqual(3.4);
      expect(s.closedHz).toBeLessThanOrEqual(78);
    }
  });

  it("rolls the low-pass downward, never upward", () => {
    for (const r of [0, 0.3, 0.7, 1]) {
      const s = thunderShape(() => r);
      expect(s.closedHz).toBeLessThan(s.openHz);
    }
  });

  it("echoes late enough to be a separate return, near enough to be one event", () => {
    for (const r of [0, 0.5, 1]) {
      const s = thunderShape(() => r);
      expect(s.echoDelay).toBeGreaterThanOrEqual(0.28);
      expect(s.echoDelay).toBeLessThanOrEqual(0.75);
      // The echo must arrive before the first clap has fully decayed.
      expect(s.echoDelay).toBeLessThan(s.seconds);
    }
  });

  it("echo is always quieter than the first roll", () => {
    for (const r of [0, 0.5, 1]) {
      expect(thunderShape(() => r).echoGain).toBeLessThan(1);
    }
  });

  it("varies between calls so repeated claps never sound identical", () => {
    const a = thunderShape(() => 0.2);
    const b = thunderShape(() => 0.9);
    expect(a.seconds).not.toBe(b.seconds);
  });

  it("clamps a misbehaving random source into a sane envelope", () => {
    const lo = thunderShape(() => -3);
    const hi = thunderShape(() => 99);
    for (const s of [lo, hi]) {
      expect(s.seconds).toBeGreaterThan(0);
      expect(s.seconds).toBeLessThan(10);
      expect(s.peak).toBeLessThan(1);
      expect(s.openHz).toBeGreaterThan(0);
    }
  });
});

describe("AMB_GAINS mix", () => {
  it("makes thunder the loudest layer", () => {
    const others = Object.entries(AMB_GAINS)
      .filter(([k]) => k !== "thunder")
      .map(([, v]) => v);
    for (const v of others) expect(AMB_GAINS.thunder).toBeGreaterThan(v);
  });

  it("keeps every layer below full scale, so the mix cannot clip", () => {
    for (const [name, gain] of Object.entries(AMB_GAINS)) {
      expect(gain, `${name} is at or over full scale`).toBeGreaterThan(0);
      expect(gain, `${name} is at or over full scale`).toBeLessThan(1);
    }
  });

  it("keeps the ambience under speech level", () => {
    // Rain is the continuous bed the user may read over; it must stay quiet.
    expect(AMB_GAINS.rain).toBeLessThan(0.08);
    expect(AMB_GAINS.rainFar).toBeLessThan(AMB_GAINS.rain);
  });

  it("makes wind prominent, as requested, but still under the clap", () => {
    // Reversed from the first mix, where wind was the quietest layer. The
    // request was for a loud, voiced wind -- but a clap must still be the peak,
    // or the storm stops having an event in it.
    expect(AMB_GAINS.wind).toBeGreaterThan(AMB_GAINS.rain);
    expect(AMB_GAINS.wind).toBeLessThan(AMB_GAINS.thunder);
  });

  it("orders the whole mix: thunder > wind > bed > rain > rainFar", () => {
    const { thunder, wind, bed, rain, rainFar } = AMB_GAINS;
    expect(thunder).toBeGreaterThan(wind);
    expect(wind).toBeGreaterThan(bed);
    expect(bed).toBeGreaterThan(rain);
    expect(rain).toBeGreaterThan(rainFar);
  });
});

describe("DUCK", () => {
  it("dips the beds without silencing them entirely", () => {
    expect(DUCK.depth).toBeGreaterThan(0);
    expect(DUCK.depth).toBeLessThan(1);
  });

  it("engages faster than it releases, which is what makes it read as a duck", () => {
    expect(DUCK.attack).toBeLessThan(DUCK.release);
  });

  it("recovers slowly enough not to pump between claps", () => {
    expect(DUCK.release).toBeGreaterThan(2);
  });
});

describe("RAIN_WIDTH", () => {
  it("is wider than the 1px WebGL default, in pixels", () => {
    // LineBasicMaterial.linewidth is a no-op in WebGL, so this needs the addon.
    expect(RAIN_WIDTH.px).toBeGreaterThan(1);
    expect(RAIN_WIDTH.px).toBeLessThan(6);
  });
});

describe("WIND_BAND", () => {
  it("sweeps a musically sensible range with real resonance", () => {
    expect(WIND_BAND.low).toBeGreaterThan(0);
    expect(WIND_BAND.high).toBeGreaterThan(WIND_BAND.low);
    expect(WIND_BAND.q).toBeGreaterThan(0.5);
  });

  it("is resonant enough to read as a voiced wind, not plain hiss", () => {
    expect(WIND_BAND.q).toBeGreaterThanOrEqual(5);
  });

  it("sweeps low, where wind lives", () => {
    expect(WIND_BAND.high).toBeLessThan(1000);
  });
});