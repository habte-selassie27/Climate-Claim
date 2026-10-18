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

/** Forward order used by `nextPhase`; `failed` is handled separately. */
const PHASE_ORDER: Record<Exclude<TxPhase, "failed">, number> = {
  idle: 0,
  submitted: 1,
  pending: 2,
  accepted: 3,
  finalized: 4,
};

/**
 * Forward-only phase movement for status re-checks (`refreshTx`).
 *
 * A re-check can observe an older status than what is on screen: the public
 * read may lag or return a partial record, and a stale read
 * must never walk the panel backwards. Allowed movements:
 *
 *   - any non-final phase -> finalized      (the appeal window closed)
 *   - pending/accepted -> failed            (CANCELED / timeout surfaced later)
 *   - failed -> pending/accepted/finalized  (a timed-out write that actually
 *     went through recovers instead of staying failed forever)
 *
 * Everything else keeps `current`. Callers filter empty records before
 * calling, so `arrived` is always a real observed status.
 */
export function nextPhase(current: TxPhase, arrived: TxPhase): TxPhase {
  if (arrived === current || arrived === "idle") return current;
  if (current === "finalized") return current;
  if (arrived === "failed") return "failed";
  if (current === "failed") return arrived;
  return PHASE_ORDER[arrived] > PHASE_ORDER[current] ? arrived : current;
}

/**
 * Stable prefix for a transaction that consensus decided but whose call failed
 * during execution on chain. The contract's state is rolled back, so nothing was
 * written; the panel must never present such a result as "accepted".
 */
export const EXECUTION_FAILED = "EXECUTION: the call failed during execution on chain, so nothing was written";

/**
 * The SDK transaction status name, whichever shape the SDK returned.
 *
 * genlayer-js@1.1.8's simplified receipt (`simplifyTransactionReceipt`) carries
 * the raw `status_name` and drops the decoded `statusName`; the full transaction
 * returned by `getTransaction()` carries `statusName`. Both are read here so the
 * same mapping serves the write poll and the refresh path.
 */
export function receiptStatusName(receipt: unknown): string | undefined {
  if (!receipt || typeof receipt !== "object") return undefined;
  const r = receipt as { statusName?: string; status_name?: string };
  return r.statusName ?? r.status_name;
}

/**
 * True when consensus decided the transaction and the call itself failed on chain.
 * Both the simplified receipt and the full transaction carry `txExecutionResultName`.
 */
export function executionFailed(receipt: { txExecutionResultName?: unknown } | null | undefined): boolean {
  return receipt?.txExecutionResultName === "FINISHED_WITH_ERROR";
}