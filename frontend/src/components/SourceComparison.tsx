import { useId, useMemo } from "react";
import type { DemoSeries } from "../fixtures/demoScenarios";
import { compareSources, type DayVerdict } from "../domain/sourceCompare";
import { dateRange } from "../domain/format";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  series: DemoSeries[];
  period: { start: string; end: string; timezone: string };
  thresholdScaled: number;
  comparator: string;
  unit: string;
}

const VERDICT_KEY: Record<DayVerdict, MessageKey> = {
  split: "compare.verdict.split",
  both: "compare.verdict.both",
  neither: "compare.verdict.neither",
  single: "compare.verdict.single",
  none: "compare.noReadings",
};

/**
 * Per-day source comparison (item 8).
 *
 * The chart shows that sources disagree; this table states exactly which day
 * and by how much. Every number comes from the same recorded series the chart
 * draws — nothing is interpolated, a day a source did not return says so, and
 * the row where the sources disagree about crossing the threshold is marked
 * and named in the summary line below the table.
 */
export function SourceComparison({ series, period, thresholdScaled, comparator, unit }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const dates = useMemo(
    () => dateRange(period.start, period.end),
    [period.start, period.end],
  );
  const { rows, splitDays } = useMemo(
    () => compareSources(series, dates, thresholdScaled, comparator),
    [series, dates, thresholdScaled, comparator],
  );

  return (
    <section aria-labelledby={titleId}>
      <div className="panel-head">
        <h3 id={titleId}>{t("compare.h")}</h3>
      </div>
      <p className="small muted">{t("compare.caption", { unit })}</p>
      <div className="table-wrap">
        <table data-testid="source-compare-table">
          <thead>
            <tr>
              <th scope="col">{t("evidence.col.date")}</th>
              {series.map((s) => (
                <th scope="col" className="num-col" key={s.sourceId}>
                  {s.label}
                </th>
              ))}
              <th scope="col" className="num-col">
                {t("compare.col.spread")} ({unit})
              </th>
              <th scope="col">{t("compare.col.verdict")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.date}
                className={row.verdict === "split" ? "compare-split-row" : undefined}
              >
                <th scope="row" className="num">
                  {row.date}
                </th>
                {row.readings.map((r) => (
                  <td key={r.sourceId} className="num-col">
                    {r.value === null ? (
                      <span className="muted">{t("compare.missing")}</span>
                    ) : (
                      `${r.value.toFixed(2)} ${unit}`
                    )}
                  </td>
                ))}
                <td className="num-col num">
                  {row.spread === null ? t("common.dash") : row.spread.toFixed(2)}
                </td>
                <td>
                  {row.verdict === "split" ? (
                    <strong>{t(VERDICT_KEY.split)}</strong>
                  ) : (
                    t(VERDICT_KEY[row.verdict])
                  )}
                  {row.incomplete && row.verdict !== "split" ? (
                    <span className="muted"> · {t("compare.incomplete")}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small" data-testid="compare-summary" style={{ marginBottom: 0 }}>
        {splitDays.length === 0
          ? t("compare.summaryNone")
          : t("compare.summaryOne", { days: splitDays.join(", ") })}
      </p>
    </section>
  );
}
