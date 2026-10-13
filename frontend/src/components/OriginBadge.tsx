interface Props {
  mode: "live" | "snapshot" | "recorded";
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
  networkLabel = "the network",
}: Props) {
  if (mode === "live") {
    return (
      <span
        className="badge badge-live"
        data-testid="origin-badge"
        title={`Read live from ${networkLabel}.`}
      >
        <span aria-hidden="true">◉</span> Live from {networkLabel}
      </span>
    );
  }
  // Still checking: say so, rather than implying the network has already failed.
  if (pending && !liveError) {
    return (
      <span
        className="badge badge-origin"
        data-testid="origin-badge"
        title={`Showing the snapshot captured ${capturedAt ?? "unknown"} while the live read completes.`}
      >
        <span aria-hidden="true">▤</span> Recorded snapshot · checking {networkLabel}
      </span>
    );
  }
  const reason = liveError
    ? ` The network could not be reached (${liveError}).`
    : "";
  return (
    <span
      className="badge badge-origin"
      data-testid="origin-badge"
      title={`Recorded on-chain snapshot captured ${capturedAt ?? "unknown"}.${reason}`}
    >
      <span aria-hidden="true">▤</span> Recorded snapshot
      {liveError ? " (network unreachable)" : ""}
    </span>
  );
}