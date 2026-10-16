import { describe, expect, it } from "vitest";
import { thunderDelayMs } from "./ambience";

describe("thunderDelayMs", () => {
  it("brings the first clap soon after enabling", () => {
    expect(thunderDelayMs(() => 0, true)).toBe(2500);
    expect(thunderDelayMs(() => 0.5, true)).toBe(3750);
    expect(thunderDelayMs(() => 1, true)).toBe(5000);
  });

  it("keeps later claps sparse", () => {
    expect(thunderDelayMs(() => 0)).toBe(9000);
    expect(thunderDelayMs(() => 0.5)).toBe(15500);
    expect(thunderDelayMs(() => 1)).toBe(22000);
  });

  it("clamps a misbehaving random source into range", () => {
    expect(thunderDelayMs(() => 5)).toBe(22000);
    expect(thunderDelayMs(() => -5, true)).toBe(2500);
  });
});
