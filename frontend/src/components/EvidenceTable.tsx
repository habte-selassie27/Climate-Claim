import type { EvidenceRecord, SourceDef } from "../domain/types";
import { fromScaled, periodLabel } from "../domain/format";
import { mapError } from "../domain/copy";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  evidence: EvidenceRecord[];
  sources: SourceDef[];
  /** Sources that failed, with the stable reason. */
}

/**
 * Evidence table: source, station/location, period, values, units, retrieval
 * reference, and whether the contract actually evaluated it.
 *
 * Every row here came out of the contract's own `get_evidence`, so all of it is
 * evaluated evidence — nothing on this table is display-only.
 */
export function EvidenceTable({ evidence, sources }: Props) {
  const { t } = useI18n();
  if (!evidence.length) {
    return (
      <div className="empty" data-testid="evidence-empty">
        No evidence was recorded for this claim.
      </div>
    );
  }

  const byId = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="table-wrap">
      <table data-testid="evidence-table">
        <caption>
          Readings the contract retrieved and evaluated. Each row is evaluated evidence, not
          display-only data.
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("evidenceTable.col.source")}</th>
            <th scope="col">{t("evidenceTable.col.station")}</th>
            <th scope="col">{t("evidenceTable.col.period")}</th>
            <th scope="col" className="num-col">
              Value
            </th>
            <th scope="col">{t("evidenceTable.col.unit")}</th>
            <th scope="col">{t("evidenceTable.col.days")}</th>
            <th scope="col">{t("evidenceTable.col.crossed")}</th>
            <th scope="col">{t("evidenceTable.col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => {
            const def = byId.get(e.source_id);
            return (
              <tr key={e.source_id}>
                <th scope="row">
                  {def?.name ?? e.source_id}
                  {def?.attribution ? (
                    <div className="small muted">{def.attribution}</div>
                  ) : null}
                </th>
                <td className="mono">{e.station || "—"}</td>
                <td className="num">{periodLabel(e.period_start, e.period_end)}</td>
                <td className="num-col num">{e.ok ? fromScaled(e.value_scaled) : "—"}</td>
                <td>{e.unit || "—"}</td>
                <td className="num-col num">{e.days_covered}</td>
                <td>{e.crossed ? "yes" : "no"}</td>
                <td>
                  {e.ok ? (
                    "evaluated"
                  ) : (
                    <>
                      <span className="finality-chip finality-failed">
                        <span aria-hidden="true">✕</span> Not evaluated
                      </span>
                      <div className="small muted" title={e.error}>
                        {mapError(e.error).message}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
