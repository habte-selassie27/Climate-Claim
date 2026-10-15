import { useCallback, useState } from "react";
import { truncateAddress, truncateHash } from "../domain/format";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  value: string;
  /** "hash" or "address" controls truncation. */
  kind?: "hash" | "address" | "raw";
  label: string;
  /** Explorer base URL. When null, no link is rendered. */
  explorerUrl?: string | null;
  /** When false, the link is rendered disabled with a reason instead of dead. */
  explorerAvailable?: boolean;
  explorerNote?: string;
}

function isTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Addresses and hashes: truncated by default, full value on focus/hover,
 * copy button with confirmation, and an explorer link built only from verified
 * config. Never invents a link.
 */
export function CopyField({
  value,
  kind = "raw",
  label,
  explorerUrl,
  explorerAvailable = true,
  explorerNote,
}: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const write = navigator?.clipboard?.writeText?.(value);
    if (write) {
      void write.then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        },
        () => setCopied(false),
      );
    }
  }, [value]);

  const display =
    kind === "hash" ? truncateHash(value) : kind === "address" ? truncateAddress(value) : value;

  const showExplorer = kind === "hash" && isTxHash(value) && explorerUrl;

  return (
    <div className="copy-field">
      <span className="visually-hidden">{label}</span>
      <span
        className="copy-value"
        title={value}
        tabIndex={0}
        onFocus={(e) => {
          e.currentTarget.textContent = value;
        }}
        onBlur={(e) => {
          e.currentTarget.textContent = display;
        }}
      >
        {display}
      </span>
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? t("copy.copied") : t("copy.copy")}
      </button>
      {showExplorer && explorerAvailable ? (
        <a href={`${explorerUrl}/transaction/${value}`} target="_blank" rel="noreferrer noopener">
          {t("copy.viewOnExplorer")}
        </a>
      ) : null}
      {showExplorer && !explorerAvailable ? (
        <span
          className="link-disabled"
          title={explorerNote ?? t("copy.explorerNoteDefault")}
        >
          {t("copy.explorerUnavailable")}
        </span>
      ) : null}
    </div>
  );
}