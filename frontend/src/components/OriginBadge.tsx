import { useI18n } from "../i18n/I18nProvider";

interface Props {
  mode: "live" | "snapshot" | "recorded" | "mixed";
  /** When the snapshot was captured on-chain. */
  capturedAt?: string;
  /** Why the live read failed, when it did. */
  liveError?: string;
  /** A live read is still in flight, so this may yet become live. */
  pending?: boolean;
  /** Human name of the network, for the live case. */
  networkLabel?: string;
}

/**
 * Says plainly whether the data on screen was read from the chain or came from
 * the committed snapshot. Never presents a snapshot as live.
 */
export function OriginBadge({
  mode,
  capturedAt,
  liveError,
  pending = false,
  networkLabel,
}: Props) {
  const { t } = useI18n();
  const network = networkLabel || t("origin.networkDefault");
  const when = capturedAt ?? t("common.unknown");

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
  // A composite that is part live, part recorded. Say so instead of overstating.
  if (mode === "mixed") {
    return (
      <span
        className="badge badge-origin"
        data-testid="origin-badge"
        title={t("origin.mixedTitle", { network, captured: when })}
      >
        <span aria-hidden="true">◑</span> {t("origin.mixed")}
      </span>
    );
  }
  // Still checking: say so, rather than implying the network has already failed.
  if (pending && !liveError) {
    return (
      <span
        className="badge badge-origin"
        data-testid="origin-badge"
        title={t("origin.checkingTitle", { captured: when })}
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
      title={`${t("origin.recordedTitle", { captured: when })}${reason}`}
    >
      <span aria-hidden="true">▤</span> {t("origin.recorded")}
      {liveError ? t("origin.recordedUnreachable") : ""}
    </span>
  );
}