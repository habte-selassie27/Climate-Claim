import { useId, useMemo } from "react";
import type { DemoScenario } from "../fixtures/demoScenarios";
import { perSourceVerdicts } from "../domain/sourceCompare";
import { dateRange } from "../domain/format";
import { useI18n } from "../i18n/I18nProvider";

/**
 * "What a deterministic chain would have said" (item 9).
 *
 * THIS PANEL IS A THOUGHT EXPERIMENT, and says so in its own heading and badge.
 * It answers a precise question: if a contract had been hard-wired to ONE of
 * the recorded sources, what would it have forced under the policy's own
 * comparison rule? Each answer is computed locally from the same recorded
 * readings the chart draws — never invented, never a chain result.
 *
 * The contrast only renders when the real answer was "inconclusive" BECAUSE
 * the sources genuinely split (one crosses, one does not). In that case the
 * deterministic answers contradict each other — one pays out, one denies —
 * while the deployed contract returns the honest third answer. When the
 * sources agree, there is no contrast to draw and the panel stays hidden.
 */
export function DeterministicContrast({ scenario }: { scenario: DemoScenario }) {
  const { t } = useI18n();
  const titleId = useId();
  const { start, end } = scenario.period;
  const dates = useMemo(() => dateRange(start, end), [start, end]);
  const verdicts = useMemo(
    () =>
      perSourceVerdicts(
        scenario.series,
        dates,
        scenario.policy.aggregation,
        scenario.policy.threshold_scaled,
        scenario.policy.comparator,
      ),
    [scenario, dates],
  );

  const splits =
    verdicts !== null &&
    verdicts.length >= 2 &&
    verdicts.some((v) => v.crosses) &&
    verdicts.some((v) => !v.crosses);
  if (!splits || scenario.expected.decision !== "inconclusive") return null;

  return (
    <section className="panel" aria-labelledby={titleId} data-testid="deterministic-contrast">
      <div className="panel-head">
        <h3 id={titleId}>{t("contrast.h")}</h3>
        <span className="badge badge-sim">{t("contrast.badge")}</span>
      </div>
      <p className="small">{t("contrast.intro")}</p>

      <div className="contrast-grid">
        {verdicts.map((v) => (
          <div className="contrast-card" key={v.sourceId}>
            <p className="small muted" style={{ margin: 0 }}>
              {t("contrast.sourceCard", { label: v.label })}
            </p>
            <p
              className={`finality-chip ${v.crosses ? "finality-final" : "finality-pending"}`}
              style={{ margin: "var(--space-2) 0" }}
            >
              <span aria-hidden="true">{v.crosses ? "✓" : "✕"}</span>{" "}
              {v.crosses ? t("contrast.verdictConfirmed") : t("contrast.verdictNotConfirmed")}
            </p>
            <p className="small" style={{ margin: 0 }}>
              {t("contrast.observed", { value: v.aggregate.toFixed(2), unit: scenario.policy.unit })}
            </p>
          </div>
        ))}

        <div className="contrast-card contrast-honest">
          <p className="small muted" style={{ margin: 0 }}>
            {t("contrast.genlayerCard")}
          </p>
          <p className="finality-chip finality-accepted" style={{ margin: "var(--space-2) 0" }}>
            <span aria-hidden="true">?</span> {t("contrast.genlayerVerdict")}
          </p>
          <p className="small" style={{ margin: 0 }}>
            {t("contrast.genlayerBody")}
          </p>
        </div>
      </div>

      <p className="small muted" style={{ marginBottom: 0 }}>
        {t("contrast.footnote")}
      </p>
    </section>
  );
}
