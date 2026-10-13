/**
 * Read path: live StudioNet reads with a committed-snapshot fallback.
 *
 * Every read goes through `readWithFallback`, which:
 *  1. throttles to stay under the public RPC's hard limit of 30 requests/minute
 *     (observed: error -32029, with a `retry_after_seconds` hint),
 *  2. retries once on a rate-limit response,
 *  3. de-duplicates in-flight requests for the same key,
 *  4. falls back to src/data/onchain-snapshot.json if the RPC is unreachable,
 *  5. records WHICH source produced the data, so the UI can label it honestly.
 *
 * The UI must never claim data is live when it came from the snapshot, and never
 * claim a snapshot is live.
 */

import { getClient } from "./client";
import { CONTRACT_ADDRESS } from "../config/contracts";
import snapshotData from "../data/onchain-snapshot.json";

const CONTRACT_FOR_READS = CONTRACT_ADDRESS as `0x${string}`;

/**
 * Where a value came from.
 *
 * - "live": read from the chain this session.
 * - "snapshot": the committed recording (src/data/onchain-snapshot.json).
 * - "mixed": a composite (e.g. the claim bundle) where SOME reads were live
 *   and others fell back to the snapshot. Labelling a partially-live object
 *   simply "live" would overstate it, so composites use "mixed".
 */
export type DataOrigin = "live" | "snapshot" | "mixed";

export interface ReadResult<T> {
  data: T;
  origin: DataOrigin;
  /** When the snapshot was captured on-chain. Undefined for live reads. */
  capturedAt?: string;
  /** Set when the live read failed and we fell back. */
  liveError?: string;
}

export const SNAPSHOT_CAPTURED_AT = (snapshotData as { capturedAt: string }).capturedAt;
export const SNAPSHOT = snapshotData as unknown as SnapshotShape;

// StudioNet allows 30 requests per minute. Spacing reads at ~2.2s keeps a
// sequential page of reads comfortably inside that.
const MIN_INTERVAL_MS = 2200;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export class RateLimitError extends Error {}

function isRateLimit(err: unknown): boolean {
  const e = err as { code?: number; cause?: { code?: number; data?: { retry_after_seconds?: number }; message?: string }; message?: string };
  const code = e?.cause?.code ?? e?.code;
  if (code === -32029) return true;
  const msg = String(e?.cause?.message ?? e?.message ?? "");
  return /rate limit/i.test(msg);
}

function retryAfterSeconds(err: unknown): number {
  const e = err as { cause?: { data?: { retry_after_seconds?: number } } };
  const hint = e?.cause?.data?.retry_after_seconds;
  return typeof hint === "number" ? hint : 10;
}

/** De-duplicate concurrent reads of the same method+args. */
const inflight = new Map<string, Promise<unknown>>();

export async function liveRead(functionName: string, args?: unknown[]): Promise<unknown> {
  const key = `${functionName}:${JSON.stringify(args ?? [])}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const run = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await throttle();
      try {
        const client = getClient();
        return await client.readContract({
          address: CONTRACT_FOR_READS,
          functionName,
          ...(args ? { args: args as never } : {}),
        });
      } catch (err) {
        if (isRateLimit(err) && attempt === 0) {
          await sleep((retryAfterSeconds(err) + 1) * 1000);
          continue;
        }
        throw err;
      }
    }
    throw new RateLimitError("Rate limited repeatedly");
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

export interface SnapshotShape {
  capturedAt: string;
  network: string;
  contract: string;
  explorerNote: string;
  owner: string;
  criteriaVersion: string;
  policyCount: number;
  claimCount: number;
  sources: unknown[];
  policies: unknown[];
  claims: Record<
    string,
    {
      claim: unknown;
      evidence: unknown[];
      checks: unknown[];
      disputes: unknown[];
      settlement: unknown;
    }
  >;
}

/**
 * Read from the chain, falling back to the snapshot. `snapshotValue` is the
 * already-extracted fallback for this exact read.
 */
export async function readWithFallback<T>(
  functionName: string,
  snapshotValue: T | undefined,
  args?: unknown[],
): Promise<ReadResult<T | undefined>> {
  try {
    const data = (await liveRead(functionName, args)) as T;
    return { data, origin: "live" };
  } catch (err) {
    return {
      data: snapshotValue,
      origin: "snapshot",
      capturedAt: SNAPSHOT_CAPTURED_AT,
      liveError: err instanceof Error ? err.message : String(err),
    };
  }
}