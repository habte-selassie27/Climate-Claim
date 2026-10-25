/**
 * Write path. Wraps verified genlayer-js calls and the tx lifecycle.
 *
 * Requires a wallet. When no account is connected the UI must not pretend to
 * write: `runWrite` fails fast with a stable error the caller maps to
 * "connect a wallet", and the demo falls back to "replay recorded result".
 *
 * The signer is read from the shared wallet store (`currentSigner`) rather than
 * probed via `window.ethereum`: the store knows which EIP-6963 wallet is
 * selected, and the signing client must carry that wallet's provider so the
 * approval prompt appears in the right extension.
 */

import { CalldataAddress } from "genlayer-js/types";
import { getClient, getWriteClient } from "./client";
import { currentSigner } from "../hooks/useWallet";
import { addressFor, CONTRACT_ADDRESS, METHODS } from "../config/contracts";
import {
  nextPhase,
  phaseForStatus,
  receiptStatusName,
  executionFailed,
  EXECUTION_FAILED,
  type TxState,
} from "./txStatus";
import { mapError } from "../domain/copy";

/**
 * A write the UI can trigger. Names match the deployed schemas exactly.
 *
 * Evaluation is two writes on purpose:
 *   `evaluate_for_claim` (ClimateEvaluator) fetches the policy's sources inside a
 *   leader/validator round and stores the result on chain;
 *   `sync_evaluation` (ClimateClaim) records that stored result against the
 *   claim, after checking it names the claim's policy version and period and
 *   agrees with the deterministic engine. Neither takes a decision as an
 *   argument, so no wallet can assert one.
 */
export type WriteKind =
  | "evaluate_for_claim"
  | "sync_evaluation"
  | "start_claim"
  | "open_dispute"
  | "finalize_decision"
  | "settle_claim"
  | "confirm_settlement"
  | "fail_settlement"
  | "create_policy"
  | "register_source"
  | "fund";

/**
 * genlayer-js encodes a plain string as a string. An `Address` parameter needs
 * the SDK's calldata type or the contract receives the wrong type and its
 * `gl.get_contract_at` call raises TypeError.
 */
function calldataAddress(hex: string): CalldataAddress {
  const bytes = hex.replace(/^0x/, "").match(/../g) ?? [];
  return new CalldataAddress(Uint8Array.from(bytes.map((b) => parseInt(b, 16))));
}

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

  const signer = currentSigner();
  if (!signer) {
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
    // The client must carry the connected account AND the selected wallet's
    // provider. Without an account the SDK throws "No account set"; without the
    // provider it would fall back to `window.ethereum`, which may belong to a
    // different wallet than the one the user chose.
    const client = await getWriteClient(signer.account, signer.provider);
    // Route by method: the contracts have separate addresses, so a single
    // configured address would send an evaluator call to the claim contract.
    // The evaluator takes the claim's address as its first argument, typed
    // `Address` on chain, so it is wrapped rather than sent as a string.
    const callArgs =
      kind === "evaluate_for_claim" ? [calldataAddress(CONTRACT_ADDRESS), ...args] : args;
    const hash = (await client.writeContract({
      address: addressFor(METHODS[kind]),
      functionName: METHODS[kind],
      args: callArgs as never,
      value: options.value ?? 0n,
    })) as `0x${string}`;

    callbacks.onHash?.(hash);
    emit({ phase: "submitted", hash });

    const receipt = await client.waitForTransactionReceipt({
      hash: hash as unknown as Parameters<typeof client.waitForTransactionReceipt>[0]["hash"],
      interval: 2000,
      retries: 150,
    });

    // Consensus may accept a transaction whose call itself fails on chain
    // (FINISHED_WITH_ERROR): the state is rolled back, so nothing was written.
    // That is a failed write, not an "accepted" one, and must be reported as
    // such instead of masquerading as a successful decision.
    if (executionFailed(receipt)) {
      const failed: TxState = {
        phase: "failed",
        hash,
        error: EXECUTION_FAILED,
        retryable: false,
      };
      emit(failed);
      return failed;
    }

    // The simplified receipt carries `status_name`; the full decode carries
    // `statusName`. Read both so the poll resolves to the real status instead
    // of stalling on `pending` because the wrong field was read.
    const phase = phaseForStatus(receiptStatusName(receipt));
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
 * Single-shot status re-check for the "Refresh status" button.
 *
 * `runWrite` stops polling once the transaction is decided, so an ACCEPTED
 * result that later finalizes would stay frozen on screen without this — the
 * panel could never show FINALIZED without a page reload. Reads the transaction
 * once, through the same status mapping the write path uses.
 *
 * Best-effort and forward-only by contract: a missing or partial record leaves
 * the state unchanged, a failed re-check returns the state unchanged, and
 * `nextPhase` guarantees the panel never walks backwards. A transaction that
 * consensus accepted but whose call failed on chain (FINISHED_WITH_ERROR) is
 * surfaced as `failed`, never as "accepted".
 */
export async function refreshTx(current: TxState): Promise<TxState> {
  if (!current.hash || current.phase === "idle" || current.phase === "finalized") {
    return current;
  }
  try {
    // A status read needs no signer, so this uses the accountless read client.
    const client = await getClient();
    const tx = await client.getTransaction({
      hash: current.hash as unknown as Parameters<typeof client.getTransaction>[0]["hash"],
    });
    const statusName = receiptStatusName(tx);
    // No record to read: that is "no information", not a status change.
    if (!statusName || statusName === "UNINITIALIZED") return current;

    // Consensus accepted the transaction but the call itself failed on chain:
    // nothing was written, so the panel must not read "accepted" as success.
    if (executionFailed(tx)) {
      if (current.phase === "failed" && current.error === EXECUTION_FAILED) return current;
      return { phase: "failed", hash: current.hash, error: EXECUTION_FAILED, retryable: false };
    }

    const next = nextPhase(current.phase, phaseForStatus(statusName));
    if (next === current.phase) return current;
    // Moving off `failed` means the recorded error no longer describes the
    // result, so it is cleared rather than carried forward.
    return next === "failed" ? { ...current, phase: next } : { phase: next, hash: current.hash };
  } catch {
    return current;
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
    if (typeof candidate === "string" && /^(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR|EXECUTION)\b/.test(candidate.trim())) {
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