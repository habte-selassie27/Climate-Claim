import { LOCALE_CODES, LOCALE_LABELS, type Locale } from "../i18n";
import { useI18n } from "../i18n/I18nProvider";

/**
 * Language switcher.
 *
 * Labels are ENDONYMS — each language is written in itself. Showing "Spanish" to
 * a visitor who only reads Spanish defeats the purpose of the control, so these
 * strings are deliberately not translated.
 *
 * A native <select> rather than a custom menu: it is keyboard accessible, works
 * on mobile, and needs no positioning or focus-trap code.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="lang-switch">
      <span className="visually-hidden">{t("lang.label")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("lang.change")}
        data-testid="lang-switch"
      >
        {LOCALE_CODES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}