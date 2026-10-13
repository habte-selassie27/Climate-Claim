/**
 * Write path. Wraps verified genlayer-js calls and the tx lifecycle.
 *
 * Requires a wallet. When no wallet is connected the UI must not pretend to
 * write: `request_evaluation` and friends throw a typed error the caller maps
 * to "connect a wallet", and the demo falls back to "replay recorded result".
 */

import { getClient } from "./client";
import { CONTRACT_ADDRESS, METHODS } from "../config/contracts";
import { phaseForStatus, type TxState } from "./txStatus";
import { mapError } from "../domain/copy";

export class NoWalletError extends Error {
  constructor() {
    super("No wallet connected");
    this.name = "NoWalletError";
  }
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getProvider(): EthereumProvider {
  if (typeof window === "undefined" || !("ethereum" in window)) throw new NoWalletError();
  return (window as unknown as { ethereum: EthereumProvider }).ethereum;
}

export async function connectedAddress(): Promise<string | null> {
  try {
    const raw = await getProvider().request({ method: "eth_requestAccounts" });
    const list = Array.isArray(raw) ? raw : [];
    return typeof list[0] === "string" ? list[0] : null;
  } catch {
    return null;
  }
}

export async function walletAvailable(): Promise<boolean> {
  return typeof window !== "undefined" && "ethereum" in window;
}

/** A write the UI can trigger. Names match the schema exactly. */
export type WriteKind =
  | "request_evaluation"
  | "open_dispute"
  | "settle_claim"
  | "start_claim"
  | "create_policy";

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
    const client = getClient();
    const hash = (await client.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: METHODS[kind],
      args: args as never,
      value: 0n,
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
  return "Unknown error";
}

export { phaseForStatus };