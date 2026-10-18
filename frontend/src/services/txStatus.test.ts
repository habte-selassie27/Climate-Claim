import { describe, expect, it } from "vitest";
import {
  IDLE,
  nextPhase,
  phaseText,
  phaseHint,
  isTerminal,
  phaseForStatus,
  type TxPhase,
} from "./txStatus";
import { setLocale } from "../i18n";

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

describe("nextPhase", () => {
  it("advances toward finality", () => {
    expect(nextPhase("submitted", "pending")).toBe("pending");
    expect(nextPhase("submitted", "accepted")).toBe("accepted");
    expect(nextPhase("pending", "accepted")).toBe("accepted");
    expect(nextPhase("accepted", "finalized")).toBe("finalized");
  });

  it("never walks backwards when a read returns an older status", () => {
    // The public consensus-data read stops serving decided transactions; an
    // empty record maps to pending and must not undo an accepted result.
    expect(nextPhase("accepted", "pending")).toBe("accepted");
    expect(nextPhase("pending", "submitted")).toBe("pending");
    expect(nextPhase("finalized", "accepted")).toBe("finalized");
    expect(nextPhase("finalized", "pending")).toBe("finalized");
  });

  it("lets failed surface from a decided write, and recovers out of failed", () => {
    expect(nextPhase("pending", "failed")).toBe("failed");
    expect(nextPhase("submitted", "failed")).toBe("failed");
    expect(nextPhase("failed", "pending")).toBe("pending");
    expect(nextPhase("failed", "accepted")).toBe("accepted");
    expect(nextPhase("failed", "finalized")).toBe("finalized");
    // A finalized result can never be undone by a later read.
    expect(nextPhase("finalized", "failed")).toBe("finalized");
  });

  it("ignores idle arrivals and same-phase arrivals", () => {
    expect(nextPhase("accepted", "idle")).toBe("accepted");
    expect(nextPhase("idle", "idle")).toBe("idle");
    expect(nextPhase("accepted", "accepted")).toBe("accepted");
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

describe("phase text", () => {
  const phases: TxPhase[] = [
    "idle",
    "submitted",
    "pending",
    "accepted",
    "finalized",
    "failed",
  ];

  it("has a distinct label for every phase", () => {
    const labels = phases.map((p) => phaseText(p));
    expect(new Set(labels).size).toBe(phases.length);
    labels.forEach((l) => expect(l.length).toBeGreaterThan(0));
  });

  it("keeps accepted and finalized textually distinct", () => {
    expect(phaseText("accepted")).not.toBe(phaseText("finalized"));
    // The accepted label must keep warning that an appeal is still possible.
    // Matched across all four locales, because the word differs per language.
    expect(phaseText("accepted")).toMatch(/appeal|impugn|contest|anfecht/i);
  });

  it("has no hint for idle and a hint for every other phase", () => {
    expect(phaseHint("idle")).toBe("");
    for (const p of phases.filter((x) => x !== "idle")) {
      expect(phaseHint(p).length).toBeGreaterThan(0);
    }
  });

  it("is translated, not hard-coded English", () => {
    const english = phaseText("pending");
    setLocale("es");
    const spanish = phaseText("pending");
    setLocale("en");
    expect(spanish).not.toBe(english);
  });
});

describe("IDLE", () => {
  it("starts in the idle phase with no hash or error", () => {
    expect(IDLE.phase).toBe("idle");
    expect(IDLE.hash).toBeUndefined();
    expect(IDLE.error).toBeUndefined();
  });
});
