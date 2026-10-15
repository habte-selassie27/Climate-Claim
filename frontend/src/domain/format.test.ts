import { describe, expect, it } from "vitest";
import {
  fromScaled,
  toNumber,
  toScaled,
  toMicroDegrees,
  microDegrees,
  truncateHash,
  truncateAddress,
  inclusiveDays,
  periodLabel,
  dateRange,
} from "./format";

describe("toNumber", () => {
  it("passes numbers through", () => {
    expect(toNumber(90)).toBe(90);
    expect(toNumber(0)).toBe(0);
  });

  it("converts bigint (how the RPC returns large scaled ints)", () => {
    expect(toNumber(90n)).toBe(90);
  });

  it("parses numeric strings and rejects junk as 0", () => {
    expect(toNumber("90")).toBe(90);
    expect(toNumber("not-a-number")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});

describe("fromScaled", () => {
  it("renders a scaled int with two decimals", () => {
    expect(fromScaled(120)).toBe("1.20");
    expect(fromScaled(90)).toBe("0.90");
    expect(fromScaled(0)).toBe("0.00");
  });
});

describe("toScaled", () => {
  it("round-trips with fromScaled", () => {
    expect(toScaled("1.20")).toBe(120);
    expect(toScaled("0.90")).toBe(90);
    expect(toScaled("5")).toBe(500);
  });

  it("returns null for an empty string, not 0", () => {
    // Number("") === 0, so a naive parse would silently send a 0 threshold.
    expect(toScaled("")).toBeNull();
    expect(toScaled("   ")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(toScaled("abc")).toBeNull();
    expect(toScaled("1.2.3")).toBeNull();
  });

  it("rounds to the nearest scaled integer", () => {
    expect(toScaled("0.999")).toBe(100);
    // Deliberately avoid exact .5 inputs: 1.005 * 100 is 100.49999… in IEEE-754,
    // so the midpoint rounds down. These land clearly either side of it.
    expect(toScaled("1.004")).toBe(100);
    expect(toScaled("1.006")).toBe(101);
  });
});

describe("coordinates", () => {
  it("converts degrees to microdegrees", () => {
    expect(toMicroDegrees("48.8566")).toBe(48856600);
    expect(toMicroDegrees("2.3522")).toBe(2352200);
  });

  it("returns null for non-numeric coordinates", () => {
    expect(toMicroDegrees("north")).toBeNull();
    expect(toMicroDegrees("")).toBeNull();
  });

  it("renders microdegrees back to 4 decimal places", () => {
    expect(microDegrees(48856600)).toBe("48.8566");
  });
});

describe("hash and address truncation", () => {
  it("truncates a full tx hash", () => {
    const hash = "0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f";
    expect(truncateHash(hash)).toBe("0x8574…809f");
  });

  it("returns an empty string for an empty hash", () => {
    expect(truncateHash("")).toBe("");
  });

  it("truncates an address to 8 leading and 6 trailing characters", () => {
    expect(truncateAddress("0x5B3661C576c7001e6d6279C67F3779705d334c89")).toBe(
      "0x5B3661…334c89",
    );
  });
});

describe("period helpers", () => {
  it("counts days inclusively of both ends", () => {
    expect(inclusiveDays("2024-06-01", "2024-06-05")).toBe(5);
    expect(inclusiveDays("2024-06-01", "2024-06-01")).toBe(1);
  });

  it("returns 0 for unparseable dates rather than NaN", () => {
    expect(inclusiveDays("not-a-date", "2024-06-05")).toBe(0);
  });

  it("labels a period with its day count", () => {
    expect(periodLabel("2024-06-01", "2024-06-05")).toBe("2024-06-01 → 2024-06-05 (5 days)");
  });

  it("enumerates every ISO date in an inclusive range", () => {
    expect(dateRange("2024-06-01", "2024-06-03")).toEqual([
      "2024-06-01",
      "2024-06-02",
      "2024-06-03",
    ]);
  });
});
