import type { SourceDef } from "../domain/types";

const KIND_QUIRKS: Record<string, string> = {
  open_meteo_archive:
    "ERA5 reanalysis on a ~9 km grid. The response reports the grid cell it actually used, which can sit several kilometres from the point you asked for.",
  open_meteo_forecast:
    "Live model output. The forecast API is more volatile than the archive and can be slower to respond.",
  nasa_power:
    "MERRA-2 reanalysis on a coarser grid than ERA5, so magnitudes often differ from Open-Meteo for the same day. That disagreement is real, not a bug.",
};

interface Props {
  source: SourceDef;
}

/**
 * Source registry card. Mirrors docs/sources.md so a reviewer can see what each
 * source provides and why two sources may legitimately disagree.
 */
export function SourceRegistryCard({ source }: Props) {
  const example = source.url_template
    .replace("{lat}", "51.505")
    .replace("{lon}", "-0.055")
    .replace("{start}", "2024-06-01")
    .replace("{end}", "2024-06-05")
    .replace("{days}", "5")
    .replace("{param}", source.param);

  return (
    <div className="panel" data-testid="source-card">
      <div className="panel-head">
        <h3>{source.name}</h3>
        <span className="badge">{source.metric}</span>
      </div>
      <dl className="terms">
        <dt>Identifier</dt>
        <dd className="mono">{source.id}</dd>
        <dt>Variable</dt>
        <dd className="mono">{source.param}</dd>
        <dt>Unit</dt>
        <dd>{source.unit}</dd>
        <dt>Attribution</dt>
        <dd>{source.attribution}</dd>
        <dt>Known quirks</dt>
        <dd>{KIND_QUIRKS[source.kind] ?? source.kind}</dd>
      </dl>
      <details className="disclosure">
        <summary>Example request</summary>
        <p className="small mono" style={{ overflowWrap: "anywhere" }}>
          {example}
        </p>
      </details>
    </div>
  );
}