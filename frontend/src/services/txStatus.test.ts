import { describe, expect, it } from "vitest";
import {
  IDLE,
  PHASE_TEXT,
  isTerminal,
  phaseForStatus,
  type TxPhase,
} from "./txStatus";

describe("phaseForStatus", () => {
  it("maps FINALIZED to finalized", () => {
    expect(phaseForStatus("FINALIZED")).toBe("finalized");
  });

  it("maps ACCEPTED to accepted — not finalized", () => {
    // The core UI rule: accepted is never rendered as final.
    expect(phaseForStatus("ACCEPTED")).toBe("accepted");
    expect(phaseForStatus("ACCEPTED")).not.toBe("finalized");
  });

  it("maps the other appealable statuses to accepted", () => {
    expect(phaseForStatus("READY_TO_FINALIZE")).toBe("accepted");
    expect(phaseForStatus("UNDETERMINED")).toBe("accepted");
  });

  it("maps in-flight statuses to pending", () => {
    for (const s of [
      "UNINITIALIZED",
      "PENDING",
      "PROPOSING",
      "COMMITTING",
      "REVEALING",
      "APPEAL_REVEALING",
      "APPEAL_COMMITTING",
    ]) {
      expect(phaseForStatus(s)).toBe("pending");
    }
  });

  it("maps cancellation and timeouts to failed", () => {
    for (const s of ["CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"]) {
      expect(phaseForStatus(s)).toBe("failed");
    }
  });

  it("defaults unknown or missing statuses to pending, not to a terminal state", () => {
    expect(phaseForStatus(undefined)).toBe("pending");
    expect(phaseForStatus("SOME_FUTURE_STATUS")).toBe("pending");
  });
});

describe("isTerminal", () => {
  it("is terminal only for finalized and failed", () => {
    expect(isTerminal("finalized")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("accepted")).toBe(false);
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("idle")).toBe(false);
    expect(isTerminal("submitted")).toBe(false);
  });
});

describe("PHASE_TEXT", () => {
  it("has a distinct label for every phase", () => {
    const phases: TxPhase[] = [
      "idle",
      "submitted",
      "pending",
      "accepted",
      "finalized",
      "failed",
    ];
    const labels = phases.map((p) => PHASE_TEXT[p]);
    expect(new Set(labels).size).toBe(phases.length);
  });

  it("keeps accepted and finalized textually distinct", () => {
    expect(PHASE_TEXT.accepted).not.toBe(PHASE_TEXT.finalized);
    expect(PHASE_TEXT.accepted).toMatch(/appeal/i);
  });
});

describe("IDLE", () => {
  it("starts in the idle phase with no hash or error", () => {
    expect(IDLE.phase).toBe("idle");
    expect(IDLE.hash).toBeUndefined();
    expect(IDLE.error).toBeUndefined();
  });
});
