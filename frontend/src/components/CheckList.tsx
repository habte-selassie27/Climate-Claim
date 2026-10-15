import type { CheckResult, CheckStatus, CheckName } from "../domain/types";
import { REQUIRED_CHECKS } from "../domain/types";
import { checkBlurb, checkLabel, checkStatusIcon, checkStatusText } from "../domain/copy";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  checks: CheckResult[];
  /** True when the contract never produced checks (evaluation failed). */
  emptyReason?: string;
}

/**
 * One row per check: icon + name + status text + short explanation.
 * Required vs optional checks are indicated, because the contract treats a
 * required check differently when validators compare results.
 */
export function CheckList({ checks, emptyReason }: Props) {
  const { t } = useI18n();

  if (!checks.length) {
    return (
      <div className="empty" data-testid="checks-empty">
        {emptyReason ?? t("check.none")}
      </div>
    );
  }

  return (
    <ul className="checklist" data-testid="checklist">
      {checks.map((check) => {
        const status = check.status as CheckStatus;
        const required = REQUIRED_CHECKS.includes(check.name as CheckName);
        return (
          <li key={check.name} className={`check-row check-${status}`}>
            <span className="check-icon" aria-hidden="true">
              {checkStatusIcon(status)}
            </span>
            <div>
              <div className="check-name">
                <span>{checkLabel(check.name as CheckName)}</span>
                <span className="check-status">{checkStatusText(status)}</span>
                <span className="required-tag">
                  {required ? t("check.required") : t("check.supporting")}
                </span>
              </div>
              <p className="check-detail">
                {check.detail
                  ? stripStatusPrefix(check.detail)
                  : checkBlurb(check.name as CheckName)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The contract stores details like "passed: the threshold comparison". The
 * status word is already shown in its own chip, so drop it from the sentence.
 *
 * These status words come from the CONTRACT, not from the locale files, so this
 * strip is deliberately locale-independent: it removes the raw enum prefix the
 * contract stored regardless of the language the UI is showing.
 */
function stripStatusPrefix(detail: string): string {
  return detail.replace(/^(passed|failed|unclear):\s*/i, "");
}