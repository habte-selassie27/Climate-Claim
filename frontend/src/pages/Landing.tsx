import { Link } from "react-router-dom";
import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import { EvidenceChart } from "../components/EvidenceChart";
import { PrecipitationField } from "../components/PrecipitationField";
import { DEMO_SCENARIOS } from "../fixtures/demoScenarios";
import { fromScaled } from "../domain/format";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Landing. Says what ClimateClaim is and shows it working, using a real
 * recorded scenario rather than an illustration.
 */
export function Landing() {
  const { t } = useI18n();
  const scenario = DEMO_SCENARIOS.find((s) => s.id === "conflicting-sources")!;

  return (
    <div className="stack">
      {/* Hero. The field behind it is driven by this page's own recorded
          readings, and is decorative only -- every number the visitor can act
          on is in the chart and tables below. */}
      <section className="hero">
        <PrecipitationField series={scenario.series} unit={scenario.policy.unit} />
        <div className="hero-inner">
          <h1>{t("landing.h1")}</h1>
          <p className="lede">{t("landing.lede")}</p>
          <div className="btn-row">
            <Link className="btn" to="/demo">
              {t("landing.openDemo")}
            </Link>
            <Link className="btn btn-secondary" to="/demo?scenario=conflicting-sources">
              {t("landing.seeConflict")}
            </Link>
            <Link className="btn btn-secondary" to="/claims">
              {t("landing.seeClaims")}
            </Link>
          </div>
        </div>
      </section>

      <div className="panel">
        <div className="panel-head">
          <h2>{t("landing.disagreement.h")}</h2>
          <span className="badge badge-sim">
            <span aria-hidden="true">▤</span> {t("datamode.historical.label")}
          </span>
        </div>
        <p>{t("landing.disagreement.p")}</p>
        <EvidenceChart
          series={scenario.series}
          period={scenario.period}
          thresholdScaled={scenario.policy.threshold_scaled}
          comparator={scenario.policy.comparator}
          unit={scenario.policy.unit}
        />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>{t("landing.whyGenLayer.h")}</h2>
          <p>{t("landing.whyGenLayer.p1")}</p>
          <p>{t("landing.whyGenLayer.p2")}</p>
          <Link to="/how-it-works">{t("landing.whyGenLayer.link")}</Link>
        </div>

        <div className="panel">
          <h2>{t("landing.wont.h")}</h2>
          <ul>
            <li>{t("landing.wont.l1")}</li>
            <li>{t("landing.wont.l2")}</li>
            <li>{t("landing.wont.l3")}</li>
            <li>{t("landing.wont.l4")}</li>
            <li>{t("landing.wont.l5")}</li>
          </ul>
          <p className="small muted">
            {t("landing.deployed", {
              address: CONTRACT_ADDRESS,
              network: net.label,
              id: net.chainId,
              scaled: fromScaled(100),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}