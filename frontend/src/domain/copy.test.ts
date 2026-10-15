import { describe, expect, it } from "vitest";
import {
  decisionCopy,
  mapError,
  errorDetail,
  reasonCopy,
  settlementCopy,
  stateCopy,
} from "./copy";

describe("mapError", () => {
  it("maps EXPECTED to a fix action and surfaces the reason verbatim", () => {
    const m = mapError("EXPECTED: not owner");
    expect(m.action).toBe("fix");
    expect(m.message).toBe("not owner");
  });

  it("maps EXTERNAL to a retryable source-unavailable message", () => {
    const m = mapError("EXTERNAL: sources_unreachable");
    expect(m.action).toBe("retry");
    expect(m.retryLabel).toBe("Try again");
    expect(m.message).toMatch(/data source/i);
  });

  it("maps TRANSIENT to a retryable network message", () => {
    const m = mapError("TRANSIENT: rpc busy");
    expect(m.action).toBe("retry");
    expect(m.message).toMatch(/temporary/i);
  });

  it("maps LLM_ERROR to a retryable evaluation message", () => {
    const m = mapError("LLM_ERROR: bad json");
    expect(m.action).toBe("retry");
    expect(m.message).toMatch(/evaluation/i);
  });

  it("treats an unknown prefix as retryable rather than crashing", () => {
    const m = mapError("WEIRD: something");
    expect(m.action).toBe("retry");
    expect(m.message).toBe("That action could not be completed.");
  });

  it("treats an empty string as retryable, not as a zero reason", () => {
    // Guards against reason === "" collapsing into an empty message.
    const m = mapError("");
    expect(m.action).toBe("retry");
    expect(m.message.length).toBeGreaterThan(0);
  });

  it("keeps colons inside the reason (split only on the first colon)", () => {
    const m = mapError("EXPECTED: policy: retired");
    expect(m.message).toBe("policy: retired");
  });
});

describe("errorDetail", () => {
  it("returns the trimmed raw string for the Details disclosure", () => {
    expect(errorDetail("  EXTERNAL: sources_unreachable \n")).toBe(
      "EXTERNAL: sources_unreachable",
    );
  });
});

describe("decisionCopy", () => {
  it("gives each decision a distinct plain-language label", () => {
    expect(decisionCopy("confirmed").label).toMatch(/confirmed/i);
    expect(decisionCopy("not_confirmed").label).toMatch(/not confirmed/i);
    expect(decisionCopy("inconclusive").label).toMatch(/inconclusive/i);
  });

  it("treats inconclusive as a result, not an error", () => {
    const c = decisionCopy("inconclusive");
    expect(c.tone).toBe("inconclusive");
    // The copy must explicitly frame it as a result, per the UI rules.
    expect(c.sentence.toLowerCase()).toMatch(/result, not an error/);
  });

  it("handles an undecided claim ('' decision) without throwing", () => {
    const c = decisionCopy("");
    expect(c.label.length).toBeGreaterThan(0);
    expect(c.sentence.length).toBeGreaterThan(0);
  });
});

describe("stateCopy", () => {
  it("covers every claim state the contract can emit", () => {
    for (const s of [
      "created",
      "pending_evaluation",
      "evidence_collected",
      "decided_confirmed",
      "decided_not_confirmed",
      "inconclusive",
      "disputed",
      "settled",
    ] as const) {
      expect(stateCopy(s).label.length).toBeGreaterThan(0);
    }
  });

  it("handles an empty state without throwing", () => {
    expect(stateCopy("").label.length).toBeGreaterThan(0);
  });
});

describe("settlementCopy", () => {
  it("labels each settlement state distinctly", () => {
    expect(settlementCopy("not_settled")).toBeTruthy();
    expect(settlementCopy("payout_emitted")).toBeTruthy();
    expect(settlementCopy("settled")).toBeTruthy();
    expect(settlementCopy("settlement_failed")).toBeTruthy();
  });
});

describe("reasonCopy", () => {
  it("maps every reason code the contract defines", () => {
    for (const r of [
      "threshold_crossed",
      "threshold_not_crossed",
      "source_conflict",
      "missing_observations",
      "location_mismatch",
      "sources_unreachable",
      "none",
    ] as const) {
      expect(reasonCopy(r).text.length).toBeGreaterThan(0);
    }
  });

  it("explains how to resolve each recoverable reason", () => {
    // These three tell the claimant what to do next, per the UI rules.
    expect(reasonCopy("source_conflict").resolve).toBeTruthy();
    expect(reasonCopy("missing_observations").resolve).toBeTruthy();
    expect(reasonCopy("sources_unreachable").resolve).toBeTruthy();
  });

  it("handles an empty reason (undecided claim)", () => {
    expect(reasonCopy("").text.length).toBeGreaterThan(0);
  });
});
