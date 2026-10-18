import { useCallback, useEffect, useRef, useState } from "react";
import type { DataOrigin, ReadResult } from "../services/rpc";

export interface ReadState<T> {
  data: T | undefined;
  /** Where the data on screen came from: "live" from the chain, "error" when a
   *  read failed. There is no recorded-data origin — see services/rpc.ts. */
  origin: DataOrigin;
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
   * WHY IT IS OFF: the public endpoint serves a shared, hard-capped number of
   * reads per hour (observed: 500/hour). This site is deployed publicly and
   * every page view is a browser hitting that shared endpoint, so reading on
   * mount let ordinary traffic exhaust the bucket for everyone -- which showed up
   * as HTTP 429 and, because the 429 carries no CORS header, as an opaque
   * `Failed to fetch` rather than a readable error.
   *
   * Off by default, a page view costs zero reads and shows its empty state.
   * `refresh()` still reads live, so nothing becomes unavailable -- it just stops
   * being automatic.
   */
  autoLive?: boolean;
}

/**
 * Read from the chain when asked, and report whether what is on screen is live.
 *
 * There is no seed any more: the recorded snapshot has been deleted, so a page
 * paints its empty state until a live read lands. `origin` is "live" or "error",
 * so nothing can be presented as on-chain data that was not read from the chain.
 *
 * Pass `autoLive` only where live data is the point of the screen and the extra
 * read is genuinely worth it.
 */
export function useRead<T>(
  read: () => Promise<ReadResult<T | undefined>>,
  deps: unknown[],
  options: UseReadOptions = {},
): ReadState<T> {
  const autoLive = options.autoLive ?? false;
  const [data, setData] = useState<T | undefined>(undefined);
  const [origin, setOrigin] = useState<DataOrigin>("error");
  const [liveError, setLiveError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(autoLive);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  /**
   * Whether a live read has ever been requested. Gates the effect below so an
   * unseeded, un-refreshed page does not read at all.
   */
  const [liveRequested, setLiveRequested] = useState(autoLive);
  const hasData = useRef(false);

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

  return { data, origin, liveError, loading, refreshing, liveRequested, refresh };
}