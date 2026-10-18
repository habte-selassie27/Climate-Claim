import { useI18n } from "../i18n/I18nProvider";

interface Props {
  mode: "live" | "recorded" | "error";
  /** Why the live read failed, when it did. */
  liveError?: string;
  /** A live read is still in flight, so this may yet become live. */
  pending?: boolean;
  /** Human name of the network, for the live case. */
  networkLabel?: string;
  /**
   * Read from the chain. Omit to render the badge alone.
   *
   * Present because reads are no longer automatic. They used to fire on mount,
   * which cost 3-5 requests per page view against a shared, capped public
   * endpoint and produced HTTP 429 for ordinary visitors. A page now shows its
   * empty state until someone asks for the chain, so this is how they ask.
   */
  onRefresh?: () => void;
  /** Reads this will cost, stated before the click rather than after. */
  readCost?: number;
}

/**
 * Says plainly whether the data on screen was read from the chain, is a recorded
 * replay, or the read failed. Never presents anything else as live.
 */
export function OriginBadge({
  mode,
  liveError,
  pending = false,
  networkLabel,
  onRefresh,
  readCost,
}: Props) {
  const { t } = useI18n();
  const network = networkLabel || t("origin.networkDefault");

  const badge = (() => {
    if (mode === "live") {
      return (
        <span
          className="badge badge-live"
          data-testid="origin-badge"
          title={t("origin.liveTitle", { network })}
        >
          <span aria-hidden="true">◉</span> {t("origin.live", { network })}
        </span>
      );
    }
    // A composite read where some sub-reads landed and some failed. Say so.
    if (mode === "error") {
      return (
        <span
          className="badge badge-origin"
          data-testid="origin-badge"
          title={t("origin.errorTitle", { network })}
        >
          <span aria-hidden="true">◑</span> {t("origin.error")}
        </span>
      );
    }
    // Still checking: say so, rather than implying the network has already failed.
    if (pending && !liveError) {
      return (
        <span
          className="badge badge-origin"
          data-testid="origin-badge"
          title={t("origin.checkingTitle", { network })}
        >
          <span aria-hidden="true">▤</span> {t("origin.checking", { network })}
        </span>
      );
    }
    const reason = liveError ? t("origin.unreachable", { error: liveError }) : "";
    return (
      <span
        className="badge badge-origin"
        data-testid="origin-badge"
        title={`${t("origin.recordedTitle")}${reason}`}
      >
        <span aria-hidden="true">▤</span> {t("origin.recorded")}
        {liveError ? t("origin.recordedUnreachable") : ""}
      </span>
    );
  })();

  // No button once live: there is nothing further to fetch, and an offer to
  // re-read the same thing invites traffic we are trying not to spend.
  if (!onRefresh || mode === "live") return badge;

  const rateLimited = liveError
    ? /rate limit|429|too many requests/i.test(liveError)
    : false;

  return (
    <span className="live-refresh">
      {badge}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onRefresh}
        disabled={pending}
        data-testid="live-refresh-button"
      >
        {pending
          ? t("data.refreshing")
          : readCost
            ? `${t("data.refreshLive")} (${readCost} ${t("data.reads")})`
            : t("data.refreshLive")}
      </button>
      {liveError && (
        <span className="live-refresh-error" role="status" data-testid="live-refresh-error">
          {rateLimited ? t("data.rateLimited") : t("data.liveFailed")}
        </span>
      )}
    </span>
  );
}