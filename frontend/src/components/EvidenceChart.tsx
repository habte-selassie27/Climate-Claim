import { useId, useMemo, useState } from "react";
import type { DemoSeries } from "../fixtures/demoScenarios";
import { comparatorSymbol } from "../domain/copy";
import { dateRange, fromScaled } from "../domain/format";

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
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
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
 */
export function EvidenceChart({
  series,
  period,
  thresholdScaled,
  comparator,
  unit,
  caption,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  const dates = useMemo(
    () => dateRange(period.start, period.end),
    [period.start, period.end],
  );

  const threshold = fromScaled(thresholdScaled);
  const thresholdNum = thresholdScaled / 100;

  const yMax = useMemo(() => {
    let max = thresholdNum;
    for (const s of series) {
      for (const d of dates) {
        const v = s.daily[d];
        if (typeof v === "number" && v > max) max = v;
      }
    }
    return niceMax(max * 1.15);
  }, [series, dates, thresholdNum]);

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
        return comparator === "gt" ? v > thresholdNum : v >= thresholdNum;
      }).length,
  );

  const conflictDays = useMemo(() => {
    if (series.length < 2) return new Set<string>();
    const set = new Set<string>();
    for (const d of dates) {
      const flags = series.map((s) => {
        const v = s.daily[d];
        if (typeof v !== "number") return null;
        return comparator === "gt" ? v > thresholdNum : v >= thresholdNum;
      });
      const present = flags.filter((f): f is boolean => f !== null);
      if (present.length > 1 && present.some((f) => f) && present.some((f) => !f)) set.add(d);
    }
    return set;
  }, [series, dates, thresholdNum, comparator]);

  const empty = series.length === 0 || dates.length === 0;

  const summary = useMemo(() => {
    if (empty) return "There is no evidence to plot for this claim.";
    const parts = series.map(
      (s, i) =>
        `${s.label} crossed the threshold on ${crossingCount[i]} ${crossingCount[i] === 1 ? "day" : "days"}`,
    );
    const gaps = series
      .map((s) => dates.filter((d) => s.daily[d] === null).length)
      .reduce((a, b) => a + b, 0);
    const tail = gaps > 0 ? ` ${gaps} reading${gaps === 1 ? " is" : "s are"} missing and not estimated.` : "";
    const conflict = conflictDays.size
      ? ` The sources disagree about crossing on ${conflictDays.size} day${conflictDays.size === 1 ? "" : "s"}.`
      : "";
    return `${parts.join("; ")}.${conflict}${tail}`;
  }, [series, dates, crossingCount, conflictDays.size, empty]);

  return (
    <section className="chart-shell" aria-labelledby={titleId}>
      <div className="panel-head">
        <h3 id={titleId}>Evidence chart</h3>
        <button
          type="button"
          className="copy-btn"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
        >
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {empty ? (
        <div className="empty" data-testid="chart-empty">
          There is no evidence to plot for this claim yet.
        </div>
      ) : showTable ? (
        <div className="table-wrap">
          <table data-testid="chart-table">
            <caption>
              Readings per source, in {unit}, against a threshold of{" "}
              {comparatorSymbol(comparator)} {threshold} {unit}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                {series.map((s) => (
                  <th scope="col" key={s.sourceId} className="num-col">
                    {s.label}
                  </th>
                ))}
                <th scope="col">Note</th>
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
            aria-label={`Evidence chart. ${summary}`}
          >
            <defs>
              <pattern id="gap-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="var(--amber-wash)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--amber-flag)" strokeWidth="2" />
              </pattern>
            </defs>

            {/* y grid + labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = M.top + PH - f * PH;
              return (
                <g key={f}>
                  <line x1={M.left} y1={y} x2={M.left + PW} y2={y} className="chart-grid" />
                  <text x={M.left - 8} y={y + 4} textAnchor="end" className="chart-label">
                    {(yMax * f).toFixed(yMax < 1 ? 2 : 1)}
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

            {/* series markers */}
            {series.map((s) =>
              dates.map((d, i) => {
                const v = s.daily[d];
                if (typeof v !== "number") return null;
                const x = xFor(i, dates.length);
                const y = yFor(v);
                const crosses = comparator === "gt" ? v > thresholdNum : v >= thresholdNum;
                return (
                  <g key={`${s.sourceId}-${d}`}>
                    {crosses ? <circle cx={x} cy={y} r={9} className="chart-crossed" opacity={0.18} /> : null}
                    {SHAPE_MARKER[s.shape](x, y)}
                    <title>{`${s.label} — ${d}: ${v} ${unit}${crosses ? " (crosses threshold)" : ""}`}</title>
                  </g>
                );
              }),
            )}

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