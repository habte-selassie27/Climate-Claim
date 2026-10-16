import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import type { Claim, Policy } from "../domain/types";
import { CopyField } from "./CopyField";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  claim: Claim;
  policy: Policy;
  /** Tx hash when a write in this session produced one. */
  txHash?: string;
}

/**
 * Audit block: criteria version, evaluation round, reason code, contract
 * address, and the transaction hash with an explorer link built only from
 * verified config.
 */
export function AuditPanel({ claim, policy, txHash }: Props) {
  const { t } = useI18n();
  const net = activeNetwork();

  return (
    <div className="stack" data-testid="audit-panel">
      <dl className="terms">
        <dt>{t("audit.criteriaVersion")}</dt>
        <dd className="mono">{claim.criteria_version}</dd>
        <dt>{t("audit.round")}</dt>
        <dd className="num">{claim.eval_round}</dd>
        <dt>{t("audit.reasonCode")}</dt>
        <dd className="mono">{claim.reason_code || t("common.dash")}</dd>
        <dt>{t("audit.finalized")}</dt>
        <dd>
          {claim.finalized ? t("audit.finalizedYes") : t("audit.finalizedNo")}
        </dd>
        <dt>{t("audit.claimId")}</dt>
        <dd className="mono">{claim.id}</dd>
        <dt>{t("audit.policyId")}</dt>
        <dd className="mono">{policy.id}</dd>
        <dt>{t("audit.contract")}</dt>
        <dd>
          <CopyField
            value={CONTRACT_ADDRESS}
            kind="address"
            label={t("audit.contractAddress")}
            explorerUrl={net.explorerUrl}
            explorerAvailable={net.explorerAvailable}
            explorerNote={net.explorerNote}
          />
        </dd>
        <dt>{t("audit.network")}</dt>
        <dd>
          {net.label} ({t("common.chain", { id: net.chainId })})
        </dd>
        {txHash ? (
          <>
            <dt>{t("audit.transaction")}</dt>
            <dd>
              <CopyField
                value={txHash}
                kind="hash"
                label={t("audit.txHash")}
                explorerUrl={net.explorerUrl}
                txPath={net.txPath}
                explorerAvailable={net.explorerAvailable}
                explorerNote={net.explorerNote}
              />
            </dd>
          </>
        ) : null}
      </dl>

      {net.explorerAvailable ? null : (
        <div className="alert alert-warn">
          <strong>{t("audit.explorerDown")}</strong>
          <p>{net.explorerNote}</p>
        </div>
      )}

      <details className="disclosure">
        <summary>{t("audit.meaningTitle")}</summary>
        <p className="small muted">{t("audit.meaning")}</p>
      </details>
    </div>
  );
}