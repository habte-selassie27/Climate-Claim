import { useCallback, useEffect, useRef, useState } from "react";
import type { DataOrigin, ReadResult } from "../services/rpc";
import { SNAPSHOT_CAPTURED_AT } from "../services/rpc";

export interface ReadState<T> {
  data: T | undefined;
  /** Where the data on screen came from. "mixed" means a composite read where
   *  some sub-reads were live and some fell back to the snapshot. */
  origin: DataOrigin;
  capturedAt?: string;
  liveError?: string;
  loading: boolean;
  /** True while refreshing with data already on screen (no skeleton flash). */
  refreshing: boolean;
  /** True once a live read has been asked for, whether or not it has landed. */
  liveRequested: boolean;
  refresh: () => void;
}

export interface UseReadOptions {
  /**
   * Read from the chain on mount. Off by default.
   *
   * WHY IT IS OFF: the public Studio endpoint serves a shared, hard-capped
   * number of reads per hour (observed: 500/hour). This site is deployed publicly
   * and every page view is a browser hitting that shared endpoint, so reading on
   * mount let ordinary traffic exhaust the bucket for everyone -- which showed up
   * as HTTP 429 and, because the 429 carries no CORS header, as an opaque
   * `Failed to fetch` in the console rather than as a readable error.
   *
   * Off by default, a page view costs zero reads and the recorded snapshot is on
   * screen immediately. `refresh()` still reads live, so nothing becomes
   * unavailable -- it just stops being automatic.
   */
  autoLive?: boolean;
}

/**
 * Hold recorded snapshot data on screen, and upgrade to live only when asked.
 *
 * The snapshot is painted on the very first frame, so there is no empty state
 * and no spinner waiting on a rate-limited network. `origin` always reports
 * which of the two is on screen, so a stale snapshot is never presented as live.
 *
 * Pass `autoLive` only where live data is the point of the screen and the extra
 * read is genuinely worth it.
 */
export function useRead<T>(
  read: () => Promise<ReadResult<T | undefined>>,
  deps: unknown[],
  seed?: T,
  options: UseReadOptions = {},
): ReadState<T> {
  const autoLive = options.autoLive ?? false;
  const seeded = seed !== undefined;
  const [data, setData] = useState<T | undefined>(seed);
  const [origin, setOrigin] = useState<DataOrigin>(seeded ? "snapshot" : "live");
  const [capturedAt, setCapturedAt] = useState<string | undefined>(seeded ? SNAPSHOT_CAPTURED_AT : undefined);
  const [liveError, setLiveError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(!seeded && autoLive);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  /**
   * Whether a live read has ever been requested. Gates the effect below so an
   * unseeded, un-refreshed page does not read at all.
   */
  const [liveRequested, setLiveRequested] = useState(autoLive);
  const hasData = useRef(seeded);

  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    // The whole point: no request unless a live read was asked for.
    if (!liveRequested) return;
    let cancelled = false;
    const run = async () => {
      if (hasData.current) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await readRef.current();
        if (cancelled) return;
        if (result.data !== undefined) setData(result.data);
        setOrigin(result.origin);
        setCapturedAt(result.capturedAt);
        setLiveError(result.liveError);
        hasData.current = true;
      } catch (err) {
        if (cancelled) return;
        setLiveError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, liveRequested]);

  const refresh = useCallback(() => {
    setLiveRequested(true);
    setNonce((n) => n + 1);
  }, []);

  return { data, origin, capturedAt, liveError, loading, refreshing, liveRequested, refresh };
}