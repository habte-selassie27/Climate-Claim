import { useTheme } from "../theme/ThemeProvider";
import { useI18n } from "../i18n/I18nProvider";

/** One glyph per resolved theme, so the control reads without relying on colour. */
const THEME_ICON = { system: "◐", light: "☀", dark: "☾" } as const;

/**
 * Theme control: system -> light -> dark -> system.
 *
 * A single cycling button rather than a segmented control, to keep the header
 * compact. The label states the CURRENT preference (including "System"), and
 * the accessible name says what activating it will do, so the control is
 * usable by screen reader and does not depend on reading the glyph.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();

  const nextLabel =
    preference === "system"
      ? t("theme.useLight")
      : preference === "light"
        ? t("theme.useDark")
        : t("theme.useSystem");

  const currentLabel = t(`theme.${preference}` as "theme.system");

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setPreference(preference === "system" ? "light" : preference === "light" ? "dark" : "system")}
      title={`${currentLabel} → ${nextLabel}`}
      aria-label={`${t("theme.label")}: ${currentLabel}`}
      data-testid="theme-toggle"
      data-preference={preference}
    >
      <span aria-hidden="true">{THEME_ICON[preference]}</span>
    </button>
  );
}