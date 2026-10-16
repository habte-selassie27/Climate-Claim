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
  refresh: () => void;
}

/**
 * Run a read once on mount, and again whenever `deps` change.
 *
 * Requests are aborted on unmount so a slow read cannot set state on a page the
 * user has already left.
 */
/**
 * Run a read once on mount, and again whenever `deps` change.
 *
 * `seed` is optional snapshot data painted on the very first frame, before any
 * network round trip. StudioNet's public endpoint serves a limited number of
 * reads per hour and the client spaces them out (see MIN_INTERVAL_MS in
 * services/rpc.ts), so a page needing several reads legitimately takes a while
 * to upgrade to live data. Seeding means
 * the reviewer sees real recorded data immediately and it is transparently
 * upgraded to live data when the chain answers. The origin badge always says
 * which of the two is on screen, so seeding never misrepresents stale data.
 */
export function useRead<T>(
  read: () => Promise<ReadResult<T | undefined>>,
  deps: unknown[],
  seed?: T,
): ReadState<T> {
  const seeded = seed !== undefined;
  const [data, setData] = useState<T | undefined>(seed);
  const [origin, setOrigin] = useState<DataOrigin>(seeded ? "snapshot" : "live");
  const [capturedAt, setCapturedAt] = useState<string | undefined>(seeded ? SNAPSHOT_CAPTURED_AT : undefined);
  const [liveError, setLiveError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(!seeded);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(seeded);

  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
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
  }, [...deps, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, origin, capturedAt, liveError, loading, refreshing, refresh };
}