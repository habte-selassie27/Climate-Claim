import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import { useI18n } from "../i18n/I18nProvider";
import { DecisionFlow } from "../components/DecisionFlow";

const net = activeNetwork();

/**
 * How it works. Plain language, no overclaiming. GenLayer terms are explained
 * once, in place, where they appear.
 */
export function HowItWorks() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <header>
        <h1>{t("how.h1")}</h1>
        <p className="lede">{t("how.lede")}</p>
      </header>

      <section className="panel">
        <DecisionFlow />
      </section>

      <section className="panel">
        <h2>{t("how.leader.h")}</h2>
        <p>{t("how.leader.p1")}</p>
        <p>{t("how.leader.p2")}</p>
      </section>

      <section className="panel">
        <h2>{t("how.equiv.h")}</h2>
        <p>{t("how.equiv.p1")}</p>
        <ul>
          <li>{t("how.equiv.l1")}</li>
          <li>{t("how.equiv.l2")}</li>
          <li>{t("how.equiv.l3")}</li>
          <li>{t("how.equiv.l4")}</li>
        </ul>
        <p>{t("how.equiv.p2")}</p>
      </section>

      <section className="panel">
        <h2>{t("how.inconclusive.h")}</h2>
        <p>{t("how.inconclusive.p1")}</p>
        <ul>
          <li>
            <strong>{t("how.inconclusive.l1t")}</strong> — {t("how.inconclusive.l1d")}
          </li>
          <li>
            <strong>{t("how.inconclusive.l2t")}</strong> — {t("how.inconclusive.l2d")}
          </li>
          <li>
            <strong>{t("how.inconclusive.l3t")}</strong> — {t("how.inconclusive.l3d")}
          </li>
          <li>
            <strong>{t("how.inconclusive.l4t")}</strong> — {t("how.inconclusive.l4d")}
          </li>
        </ul>
        <p>{t("how.inconclusive.p2")}</p>
      </section>

      <section className="panel">
        <h2>{t("how.finality.h")}</h2>
        <p>{t("how.finality.p1")}</p>
        <p>{t("how.finality.p2")}</p>
      </section>

      <section className="panel">
        <h2>{t("how.datamode.h")}</h2>
        <p>{t("how.datamode.p1")}</p>
        <p>
          {t("how.datamode.p2", {
            address: CONTRACT_ADDRESS,
            network: net.label,
            id: net.chainId,
          })}
        </p>
      </section>

      <section className="panel">
        <h2>{t("how.limits.h")}</h2>
        <ul>
          <li>{t("how.limits.l1")}</li>
          <li>{t("how.limits.l2")}</li>
          <li>{t("how.limits.l3")}</li>
          <li>{t(net.explorerAvailable ? "how.limits.l4ok" : "how.limits.l4down")}</li>
        </ul>
      </section>
    </div>
  );
}