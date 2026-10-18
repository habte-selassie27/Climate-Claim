/**
 * Read path: live reads against the deployed contracts, with no recorded-data
 * fallback.
 *
 * An earlier version of this file fell back to a committed snapshot
 * (src/data/onchain-snapshot.json) whenever the RPC failed. That snapshot held
 * 6 policies and 5 claims read from a contract that is no longer deployed
 * (0xE16032420e3155C0822e9150a98c6B1163869F0c on StudioNet), so a transient RPC
 * failure silently rendered another deployment's records as if they were current.
 *
 * That fallback is gone, deliberately. An empty state is correct when the chain
 * cannot be reached; a fabricated list is not. The snapshot file has been deleted
 * rather than repointed, because there is nothing honest to repoint it to.
 *
 * Every read goes through `liveRead`, which:
 *  1. throttles to stay under the public RPC's observed ceiling,
 *  2. retries once on a rate-limit response,
 *  3. de-duplicates in-flight requests for the same key,
 *  4. propagates failures, so the caller can show an error instead of old data.
 */

import { getClient } from "./client";
import { addressFor } from "../config/contracts";

/**
 * Where a value came from.
 *
 * - "live": read from the chain this session.
 * - "error": the read failed and no data is shown.
 *
 * There is no longer a "snapshot" origin, because there is no longer a snapshot.
 */
export type DataOrigin = "live" | "error";

export interface ReadResult<T> {
  data: T;
  origin: DataOrigin;
  /** Set when the live read failed. Undefined on success. */
  liveError?: string;
}

/** No snapshot exists, so there is no captured-at date or source contract to name. */

/**
 * Minimum spacing between reads, in ms.
 *
 * DERIVED, not guessed. StudioNet's observed `standard` bucket is 500 requests
 * per hour, which is 8.3 per minute -- one read every ~7.2s. This used to be
 * 2200ms, derived from a "30 requests per minute" figure that the endpoint no
 * longer honours: at 2200ms the app issued ~27 reads/min, roughly 3.3x over the
 * real ceiling, so a single browse session could exhaust the bucket for
 * everyone behind the same address and lock out the writes that need it.
 *
 * Verified against the live StudioNet endpoint 2026-10-17:
 *   {"bucket":"standard","window":"hour","limit":500,"current":500}
 *
 * MEASURED ON STUDIONET. The active deployment lives on Bradbury, whose
 * heavy-method ceiling has not been measured -- plain JSON-RPC there (e.g.
 * `eth_chainId`) is unmetered, but contract calls are not. The budget is kept
 * unchanged rather than loosened, because loosening it would be a guess in the
 * unsafe direction: if Bradbury meters as StudioNet does, a faster pace would
 * spend the bucket that writes also need.
 */
const OBSERVED_READS_PER_HOUR = 500;
/**
 * Deliberately slower than the ceiling (8.3/min). Headroom absorbs the retry
 * that `liveRead` performs after a 429, so a throttled read plus its retry
 * cannot cross the line. Raising this trades page latency for headroom, and with
 * no snapshot to paint immediately a slow page is a visibly empty one, so the
 * budget is left conservative.
 */
const READS_PER_MINUTE_BUDGET = 6;
const MIN_INTERVAL_MS = Math.ceil(60_000 / READS_PER_MINUTE_BUDGET);

/**
 * Smallest safe spacing: one read per `ms`.
 *
 * Ceiling spacing is the FASTEST safe rate, so a safe configuration is one
 * whose spacing is AT LEAST the ceiling's. It is a mistake to read the safety
 * condition backwards -- an earlier version of this file compared the wrong
 * direction and threw on the correct configuration, which blanked every screen
 * in the deployed app. Hence the explicit intervalMs/ceilingMs parameters and
 * the tests below, which execute this rather than grep for it.
 */
export function assertReadBudgetSafe(
  intervalMs: number,
  ceilingMs: number,
): void {
  if (intervalMs < ceilingMs) {
    throw new Error(
      `read budget is above the endpoint's ceiling: ${intervalMs}ms is faster than ` +
        `the ${Math.ceil(ceilingMs)}ms the endpoint allows ` +
        `(${OBSERVED_READS_PER_HOUR} reads/hour)`,
    );
  }
}

/** Fastest spacing the observed limit permits: one read per this many ms. */
export const READ_CEILING_MS = 60_000 / (OBSERVED_READS_PER_HOUR / 60);

assertReadBudgetSafe(MIN_INTERVAL_MS, READ_CEILING_MS);
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
        const client = await getClient();
        // Route to whichever contract owns this method. The project deploys as
        // two contracts, so a single address here would send policy reads to the
        // claim contract (or the reverse) and fail.
        return await client.readContract({
          address: addressFor(functionName),
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

/**
 * Read from the chain, recording which source produced the value.
 *
 * On failure this returns `{ data: undefined, origin: "error" }` with the error
 * message, rather than substituting recorded data. Callers render the empty or
 * error state from that.
 */
export async function readLive<T>(functionName: string, args?: unknown[]): Promise<ReadResult<T | undefined>> {
  try {
    const data = (await liveRead(functionName, args)) as T;
    return { data, origin: "live" };
  } catch (err) {
    return {
      data: undefined,
      origin: "error",
      liveError: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * @deprecated Kept as an alias so a caller that still says `readWithFallback`
 * fails loudly rather than silently reintroducing a fallback path.
 */
export async function readWithFallback<T>(
  functionName: string,
  _unused: T | undefined,
  args?: unknown[],
): Promise<ReadResult<T | undefined>> {
  return readLive<T>(functionName, args);
}
