import type { DataMode } from "../domain/types";
import { dataModeCopy, dataModeIcon } from "../domain/copy";

interface Props {
  mode: DataMode | "";
  /** Where the values shown actually came from (chain read vs replay vs both). */
  origin?: "live" | "snapshot" | "recorded" | "mixed";
}

/**
 * Data-mode badge. Two variants with different shape/icon AND label, so the
 * distinction survives without colour. Always visible on policy and claim
 * surfaces.
 */
export function DataModeBadge({ mode, origin }: Props) {
  const { label, blurb } = dataModeCopy(mode);
  const isLive = mode === "live";
  return (
    <span
      className={`badge ${isLive ? "badge-live" : "badge-sim"}`}
      title={blurb}
      data-testid="data-mode-badge"
    >
      <span aria-hidden="true">{dataModeIcon(mode)}</span>
      {label}
      {origin === "snapshot" ? (
        <span className="badge-origin" title="Read from a captured snapshot, not the live chain.">
          · recorded
        </span>
      ) : null}
      {origin === "mixed" ? (
        <span
          className="badge-origin"
          title="Some of this was read live; some came from the captured snapshot."
        >
          · mixed
        </span>
      ) : null}
    </span>
  );
}

/** Longer form, for claim detail where the distinction matters most. */
export function DataModePanel({ mode }: { mode: DataMode | "" }) {
  const { label, blurb } = dataModeCopy(mode);
  return (
    <p className="small muted" data-testid="data-mode-explanation">
      <strong>{label}.</strong> {blurb}
    </p>
  );
}