/**
 * Write lifecycle (UI.md section 6).
 *
 * The contract's real transaction statuses were read from genlayer-js@1.1.8
 * (the `TransactionStatus` enum), and are mapped onto the UI's five states here.
 * The UI vocabulary is deliberately NOT the SDK's vocabulary.
 *
 * Critically: `accepted` and `finalized` are distinct everywhere. An accepted
 * decision is never rendered as final.
 */

import { t } from "../i18n";

/**
 * The SDK's transaction status names, mirrored here.
 *
 * genlayer-js@1.1.8 defines a `TransactionStatus` enum but does not re-export it
 * from the package root, so the union is declared locally. The values are taken
 * from the installed SDK's type definitions and were confirmed against real
 * StudioNet receipts (`status_name: 'ACCEPTED'`).
 */
export type SdkTxStatus =
  | "UNINITIALIZED"
  | "PENDING"
  | "PROPOSING"
  | "COMMITTING"
  | "REVEALING"
  | "ACCEPTED"
  | "UNDETERMINED"
  | "FINALIZED"
  | "CANCELED"
  | "APPEAL_REVEALING"
  | "APPEAL_COMMITTING"
  | "READY_TO_FINALIZE"
  | "VALIDATORS_TIMEOUT"
  | "LEADER_TIMEOUT";

export type TxPhase =
  | "idle"
  | "submitted"
  | "pending"
  | "accepted"
  | "finalized"
  | "failed";

export interface TxState {
  phase: TxPhase;
  /** Full transaction hash, once known. */
  hash?: string;
  /** Stable error string from the contract or the network, for the Details panel. */
  error?: string;
  /** True when the error is a retryable contract prefix. */
  retryable?: boolean;
}

export const IDLE: TxState = { phase: "idle" };

/** Map an SDK transaction status onto the UI phase. */
export function phaseForStatus(status: SdkTxStatus | string | undefined): TxPhase {
  switch (status) {
    case "FINALIZED":
      return "finalized";
    case "ACCEPTED":
    case "READY_TO_FINALIZE":
    case "UNDETERMINED":
      // Accepted but still appealable. Never shown as final.
      return "accepted";
    case "CANCELED":
    case "VALIDATORS_TIMEOUT":
    case "LEADER_TIMEOUT":
      return "failed";
    case "UNINITIALIZED":
    case "PENDING":
    case "PROPOSING":
    case "COMMITTING":
    case "REVEALING":
    case "APPEAL_REVEALING":
    case "APPEAL_COMMITTING":
      return "pending";
    default:
      return "pending";
  }
}

/** Is this a terminal phase (stop polling)? */
export function isTerminal(phase: TxPhase): boolean {
  return phase === "finalized" || phase === "failed";
}

/**
 * Phase label and hint, resolved for the active locale.
 *
 * These were `Record<TxPhase, string>` constants holding English text. They are
 * now functions over message keys so the label follows the chosen language; a
 * Record of pre-rendered strings would freeze English at module load, before any
 * locale had been resolved.
 */
const PHASE_KEY = {
  idle: "tx.idle",
  submitted: "tx.submitted",
  pending: "tx.pending",
  accepted: "tx.accepted",
  finalized: "tx.finalized",
  failed: "tx.failed",
} as const satisfies Record<TxPhase, string>;

const PHASE_HINT_KEY = {
  idle: "",
  submitted: "tx.hint.submitted",
  pending: "tx.hint.pending",
  accepted: "tx.hint.accepted",
  finalized: "tx.hint.finalized",
  failed: "tx.hint.failed",
} as const satisfies Record<TxPhase, string>;

export function phaseText(phase: TxPhase): string {
  return t(PHASE_KEY[phase]);
}

export function phaseHint(phase: TxPhase): string {
  const key = PHASE_HINT_KEY[phase];
  return key ? t(key) : "";
}

/** Icon glyph so state is never conveyed by colour alone. */
export const PHASE_ICON: Record<TxPhase, string> = {
  idle: "○",
  submitted: "◔",
  pending: "◑",
  accepted: "◕",
  finalized: "●",
  failed: "✕",
};

export const PHASE_TONE: Record<TxPhase, "idle" | "progress" | "accepted" | "final" | "failed"> = {
  idle: "idle",
  submitted: "progress",
  pending: "progress",
  accepted: "accepted",
  finalized: "final",
  failed: "failed",
};