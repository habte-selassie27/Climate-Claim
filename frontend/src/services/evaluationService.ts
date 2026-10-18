/**
 * Write path. Wraps verified genlayer-js calls and the tx lifecycle.
 *
 * Requires a wallet. When no wallet is connected the UI must not pretend to
 * write: `runWrite` fails fast with a stable error the caller maps to
 * "connect a wallet", and the demo falls back to "replay recorded result".
 */

import { getClient } from "./client";
import { addressFor, METHODS } from "../config/contracts";
import { phaseForStatus, type TxState } from "./txStatus";
import { mapError } from "../domain/copy";

async function walletAvailable(): Promise<boolean> {
  return typeof window !== "undefined" && "ethereum" in window;
}

/**
 * A write the UI can trigger. Names match the deployed schemas exactly.
 *
 * `record_evaluation` REPLACES `request_evaluation`. That is a real change in
 * meaning, not a rename: `request_evaluation` made the contract fetch weather
 * data, ask a model and compute the threshold itself, so any wallet could start
 * a consensus evaluation. `record_evaluation` is OWNER-ONLY and takes the
 * decision as an argument -- the contract stores what it is told and verifies
 * nothing about it. The UI must not present it as "evaluate this claim".
 */
export type WriteKind =
  | "register_policy_snapshot"
  | "start_claim"
  | "record_evaluation"
  | "open_dispute"
  | "resolve_dispute"
  | "finalize_decision"
  | "settle_claim"
  | "confirm_settlement"
  | "fail_settlement"
  | "create_policy"
  | "register_source"
  | "fund";

export interface WriteCallbacks {
  /** Called once the tx hash is known, so the UI can show and persist it. */
  onHash?: (hash: string) => void;
  /** Called on every observed status change. */
  onPhase?: (state: TxState) => void;
}

/**
 * Submit a write and poll until it reaches a terminal phase.
 *
 * The verified mechanism is `client.waitForTransactionReceipt({ hash, interval, retries })`.
 * Polling stops at a terminal phase (see `isTerminal`). Manual refresh remains
 * available to the user, but nothing polls in the background after completion.
 */
export async function runWrite(
  kind: WriteKind,
  args: unknown[],
  callbacks: WriteCallbacks = {},
  options: { value?: bigint } = {},
): Promise<TxState> {
  const emit = (next: TxState) => {
    callbacks.onPhase?.(next);
  };

  if (!(await walletAvailable())) {
    const mapped = mapError("EXPECTED: no wallet connected");
    const failed: TxState = {
      phase: "failed",
      error: "No wallet connected. Connect an account to send a transaction to GenLayer.",
      retryable: mapped.action === "retry",
    };
    emit(failed);
    return failed;
  }

  try {
    emit({ phase: "submitted" });
    const client = await getClient();
    // Route by method: the two contracts have separate addresses, so a single
    // configured address would send policy writes to the claim contract.
    const hash = (await client.writeContract({
      address: addressFor(METHODS[kind]),
      functionName: METHODS[kind],
      args: args as never,
      value: options.value ?? 0n,
    })) as `0x${string}`;

    callbacks.onHash?.(hash);
    emit({ phase: "submitted", hash });

    const receipt = await client.waitForTransactionReceipt({
      hash: hash as unknown as Parameters<typeof client.waitForTransactionReceipt>[0]["hash"],
      interval: 2000,
      retries: 150,
    });

    // `statusName` carries the human-readable SDK status. Real receipts read
    // `status_name: 'ACCEPTED'`, so an accepted-but-not-final result is normal.
    const phase = phaseForStatus(receipt?.statusName);
    const finalized: TxState = { phase, hash };
    emit(finalized);
    return finalized;
  } catch (err) {
    const raw = extractErrorString(err);
    const mapped = mapError(raw);
    const failed: TxState = {
      phase: "failed",
      error: `${mapped.message}${raw ? ` (${raw})` : ""}`,
      retryable: mapped.action === "retry",
    };
    emit(failed);
    return failed;
  }
}

/**
 * Pull the stable prefix out of whatever the SDK or node threw.
 *
 * GenLayer surfaces contract reverts as readable strings like
 * "EXPECTED: duplicate claim". Unwrap the viem/abitype envelopes to find it,
 * and never show a stack trace to the user.
 */
export function extractErrorString(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as {
    message?: string;
    shortMessage?: string;
    details?: string;
    cause?: { message?: string; details?: string };
  };
  const candidates = [e.details, e.shortMessage, e.cause?.details, e.cause?.message, e.message];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\b/.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 300);
  }
  // Nothing usable anywhere on the error. On this endpoint that is not an
  // abstract failure: a 429 from StudioNet arrives WITHOUT CORS headers, so the
  // browser aborts it and the SDK hands back an error object with no message at
  // all. Saying "Unknown error" for that is technically true and practically
  // useless -- it reads like a bug in the app rather than a full read budget.
  return "the request was blocked before it could be read (the public endpoint returns a rate-limit response without CORS headers, so the browser discards it)";
}

export { phaseForStatus };