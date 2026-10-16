import type * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DemoSeries } from "../fixtures/demoScenarios";
import { comparatorSymbol } from "../domain/copy";
import { formatTick, niceScale } from "../domain/chartScale";
import { dateRange, fromScaled } from "../domain/format";
import { meetsThreshold } from "../domain/sourceCompare";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  series: DemoSeries[];
  period: { start: string; end: string; timezone: string };
  thresholdScaled: number;
  comparator: string;
  unit: string;
  /** Rendered above the chart to explain what is contract data vs display detail. */
  caption?: string;
}

const W = 720;
const H = 300;
const M = { top: 30, right: 28, bottom: 52, left: 58 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const SHAPE_MARKER = {
  square: (x: number, y: number) => (
    <rect x={x - 5} y={y - 5} width={10} height={10} className="chart-marker-pass" />
  ),
  circle: (x: number, y: number) => <circle cx={x} cy={y} r={5.5} className="chart-marker-pass" />,
  triangle: (x: number, y: number) => (
    <polygon
      points={`${x},${y - 6} ${x + 6},${y + 5} ${x - 6},${y + 5}`}
      className="chart-marker-pass"
    />
  ),
} as const;

const SHAPE_NAME: Record<DemoSeries["shape"], string> = {
  square: "square",
  circle: "circle",
  triangle: "triangle",
};

/** Round the top of the axis up to something readable. */
/** One focusable data point: a single source on a single day. */
interface ChartPoint {
  key: string;
  x: number;
  y: number;
  crosses: boolean;
  shape: DemoSeries["shape"];
  label: string;
}

/**
 * EvidenceChart — readings per source against the policy threshold.
 *
 * Design requirements from UI.md section 5.1, all honoured:
 *  - per-source series distinguished by SHAPE and label, not colour alone;
 *  - threshold line in --threshold-ink, labelled with value, unit, comparator;
 *  - missing observations drawn as a hatched span, never interpolated;
 *  - disagreements about crossing flagged where they occur;
 *  - a data-table alternative and a text summary for screen readers;
 *  - renders correctly with zero, one and many sources, and with empty data.
 *
 * Accessibility (item 11): the svg carries a SHORT label (source and day count
 * only — the full narrative lives in the visible summary line below, which
 * screen readers reach in document order). Each data point is a separate
 * focusable element with its own label, navigated with the arrow keys and
 * Home/End once focus is inside the chart, so the values are reachable without
 * the table toggle.
 */
export function EvidenceChart({
  series,
  period,
  thresholdScaled,
  comparator,
  unit,
  caption,
}: Props) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  const dates = useMemo(
    () => dateRange(period.start, period.end),
    [period.start, period.end],
  );

  const threshold = fromScaled(thresholdScaled);
  const thresholdNum = thresholdScaled / 100;

  /**
   * Axis scale. The step is chosen first and the top derived from it, so every
   * gridline carries a round label. The old code divided the top into quarters
   * and rounded each label, which produced uneven numbers on evenly spaced lines.
   */
  const scale = useMemo(() => {
    let max = thresholdNum;
    for (const s of series) {
      for (const d of dates) {
        const v = s.daily[d];
        if (typeof v === "number" && v > max) max = v;
      }
    }
    return niceScale(max * 1.15);
  }, [series, dates, thresholdNum]);
  const yMax = scale.top;

  const xFor = (index: number, n: number) =>
    M.left + (n <= 1 ? PW / 2 : (index * PW) / (n - 1));
  const yFor = (value: number) => M.top + PH - (value / yMax) * PH;

  const bandWidth = dates.length > 1 ? PW / (dates.length - 1) : PW;
  const halfBand = Math.min(bandWidth / 2, 34);

  // Which source crosses on which day, for the conflict flag.
  const crossingCount = series.map(
    (s) =>
      dates.filter((d) => {
        const v = s.daily[d];
        if (typeof v !== "number") return false;
        return meetsThreshold(v, thresholdNum, comparator);
      }).length,
  );

  const conflictDays = useMemo(() => {
    if (series.length < 2) return new Set<string>();
    const set = new Set<string>();
    for (const d of dates) {
      const flags = series.map((s) => {
        const v = s.daily[d];
        if (typeof v !== "number") return null;
        return meetsThreshold(v, thresholdNum, comparator);
      });
      const present = flags.filter((f): f is boolean => f !== null);
      if (present.length > 1 && present.some((f) => f) && present.some((f) => !f)) set.add(d);
    }
    return set;
  }, [series, dates, thresholdNum, comparator]);

  const empty = series.length === 0 || dates.length === 0;

  // Day-major, so the arrow keys walk forward in time; each point carries the
  // full sentence a screen reader announces when it takes focus.
  const points = useMemo(() => {
    const out: ChartPoint[] = [];
    dates.forEach((d, i) => {
      for (const s of series) {
        const v = s.daily[d];
        if (typeof v !== "number") continue;
        const crosses = meetsThreshold(v, thresholdNum, comparator);
        out.push({
          key: `${s.sourceId}-${d}`,
          x: xFor(i, dates.length),
          y: yFor(v),
          crosses,
          shape: s.shape,
          label: crosses
            ? t("evidence.pointPass", { source: s.label, date: d, value: v.toFixed(2), unit })
            : t("evidence.pointFail", { source: s.label, date: d, value: v.toFixed(2), unit }),
        });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, dates, thresholdNum, comparator, yMax, t, unit]);

  const [activeIndex, setActiveIndex] = useState(0);
  const pointRefs = useRef<Array<SVGGElement | null>>([]);
  const pendingFocus = useRef(false);
  const active = points.length === 0 ? 0 : Math.min(activeIndex, points.length - 1);

  // Moving the cursor only takes real focus once a key handler asked for it;
  // otherwise a re-render would steal focus from wherever the user was.
  useEffect(() => {
    if (pendingFocus.current) {
      pendingFocus.current = false;
      pointRefs.current[active]?.focus();
    }
  }, [active]);

  const move = (next: number) => {
    if (points.length === 0) return;
    pendingFocus.current = true;
    setActiveIndex(Math.min(Math.max(next, 0), points.length - 1));
  };

  const onPointKeyDown = (event: React.KeyboardEvent<SVGGElement>, i: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(i + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(i - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(points.length - 1);
    }
  };

  const summary = useMemo(() => {
    if (empty) return t("evidence.noData");
    const parts = series.map((s, i) =>
      t(crossingCount[i] === 1 ? "evidence.summaryCrossedOne" : "evidence.summaryCrossedMany", {
        label: s.label,
        days: crossingCount[i],
      }),
    );
    const gaps = series
      .map((s) => dates.filter((d) => s.daily[d] === null).length)
      .reduce((a, b) => a + b, 0);
    const tail =
      gaps > 0
        ? ` ${t(gaps === 1 ? "evidence.summaryMissingOne" : "evidence.summaryMissingMany", { days: gaps })}`
        : "";
    const conflict = conflictDays.size
      ? ` ${t(conflictDays.size === 1 ? "evidence.summaryConflictOne" : "evidence.summaryConflictMany", { days: conflictDays.size })}`
      : "";
    return `${parts.join("; ")}.${conflict}${tail}`;
  }, [series, dates, crossingCount, conflictDays.size, empty, t]);

  return (
    <section className="chart-shell" aria-labelledby={titleId}>
      <div className="panel-head">
        <h3 id={titleId}>{t("evidence.chart")}</h3>
        <button
          type="button"
          className="copy-btn"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? t("evidence.showChart") : t("evidence.showTable")}
        </button>
      </div>

      {empty ? (
        <div className="empty" data-testid="chart-empty">
          {t("evidence.noData")}
        </div>
      ) : showTable ? (
        <div className="table-wrap">
          <table data-testid="chart-table">
            <caption>
              {t("evidence.captionTable", {
                unit,
                comparator: comparatorSymbol(comparator),
                threshold,
              })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("evidence.col.date")}</th>
                {series.map((s) => (
                  <th scope="col" key={s.sourceId} className="num-col">
                    {s.label}
                  </th>
                ))}
                <th scope="col">{t("evidence.col.note")}</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d}>
                  <th scope="row" className="num">
                    {d}
                  </th>
                  {series.map((s) => (
                    <td key={s.sourceId} className="num-col">
                      {typeof s.daily[d] === "number" ? (
                        `${s.daily[d]} ${unit}`
                      ) : (
                        <span className="muted">no reading</span>
                      )}
                    </td>
                  ))}
                  <td>{conflictDays.has(d) ? "sources disagree on crossing" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-scroll">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={
              series.length === 1
                ? t("evidence.chartAriaOne", { days: dates.length })
                : t("evidence.chartAriaMany", { sources: series.length, days: dates.length })
            }
          >
            <defs>
              <pattern id="gap-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="var(--amber-wash)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--amber-flag)" strokeWidth="2" />
              </pattern>
            </defs>

            {/* y grid + labels, on the round step from `scale` */}
            {scale.ticks.map((tick) => {
              const y = yFor(tick);
              return (
                <g key={tick}>
                  <line x1={M.left} y1={y} x2={M.left + PW} y2={y} className="chart-grid" />
                  <text x={M.left - 8} y={y + 4} textAnchor="end" className="chart-label">
                    {formatTick(tick, scale.decimals)}
                  </text>
                </g>
              );
            })}
            <text
              x={M.left - 8}
              y={M.top - 12}
              textAnchor="end"
              className="chart-label"
            >
              {unit}
            </text>

            {/* x axis */}
            <line x1={M.left} y1={M.top + PH} x2={M.left + PW} y2={M.top + PH} className="chart-axis" />
            {dates.map((d, i) => (
              <text
                key={d}
                x={xFor(i, dates.length)}
                y={M.top + PH + 18}
                textAnchor="middle"
                className="chart-label"
              >
                {d.slice(5)}
              </text>
            ))}
            <text x={M.left + PW / 2} y={H - 10} textAnchor="middle" className="chart-label">
              Day of {period.start} → {period.end} ({period.timezone})
            </text>

            {/* threshold line — the only use of --threshold-ink */}
            {thresholdNum <= yMax ? (
              <g>
                <line
                  x1={M.left}
                  y1={yFor(thresholdNum)}
                  x2={M.left + PW}
                  y2={yFor(thresholdNum)}
                  className="chart-threshold"
                />
                <text
                  x={M.left + PW}
                  y={yFor(thresholdNum) - 7}
                  textAnchor="end"
                  className="chart-threshold-label"
                >
                  threshold {comparatorSymbol(comparator)} {threshold} {unit}
                </text>
              </g>
            ) : null}

            {/* gaps first, so markers draw on top */}
            {series.map((s) =>
              dates.map((d, i) =>
                s.daily[d] === null ? (
                  <g key={`${s.sourceId}-gap-${d}`}>
                    <rect
                      x={xFor(i, dates.length) - halfBand / 2}
                      y={M.top + 4}
                      width={halfBand}
                      height={PH - 4}
                      fill="url(#gap-hatch)"
                    />
                  </g>
                ) : null,
              ),
            )}

            {/* focusable data points — arrow keys walk them in day order */}
            {points.map((p, i) => (
              <g
                key={p.key}
                className="chart-point"
                tabIndex={i === active ? 0 : -1}
                role="img"
                aria-label={p.label}
                ref={(el) => {
                  pointRefs.current[i] = el;
                }}
                onFocus={() => setActiveIndex(i)}
                onKeyDown={(e) => onPointKeyDown(e, i)}
              >
                {p.crosses ? (
                  <circle cx={p.x} cy={p.y} r={9} className="chart-crossed" opacity={0.18} />
                ) : null}
                {SHAPE_MARKER[p.shape](p.x, p.y)}
                <title>{p.label}</title>
              </g>
            ))}

            {/* conflict flags */}
            {[...conflictDays].map((d) => {
              const i = dates.indexOf(d);
              return (
                <text
                  key={`conflict-${d}`}
                  x={xFor(i, dates.length)}
                  y={M.top - 10}
                  textAnchor="middle"
                  className="chart-gap-label"
                >
                  ▲ sources disagree
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {!empty ? (
        <>
          <div className="chart-legend">
            {series.map((s) => (
              <span className="legend-item" key={s.sourceId}>
                <svg width="16" height="16" aria-hidden="true" viewBox="0 0 16 16">
                  {SHAPE_MARKER[s.shape](8, 8)}
                </svg>
                {s.label} ({SHAPE_NAME[s.shape]})
              </span>
            ))}
            <span className="legend-item">
              <svg width="26" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="26" y2="5" className="chart-threshold" />
              </svg>
              Threshold
            </span>
            <span className="legend-item">
              <svg width="16" height="16" aria-hidden="true">
                <rect width="16" height="16" fill="url(#gap-hatch)" />
              </svg>
              No reading
            </span>
          </div>
          <p className="chart-summary" data-testid="chart-summary">
            {summary}
          </p>
        </>
      ) : null}

      {caption ? <p className="small muted">{caption}</p> : null}
    </section>
  );
}
