/**
 * i18n core.
 *
 * NO LIBRARY ON PURPOSE. The project already hand-rolls `domain/copy.ts` to map
 * contract enums to UI text, so a ~100-line context plus a dictionary fits the
 * existing style and keeps the bundle free of an i18n dependency.
 *
 * COMPLETENESS IS ENFORCED BY THE TYPE SYSTEM. `locales/en.ts` is the source of
 * truth and `MessageKey` is derived from it; every other locale is declared as
 * `Record<MessageKey, string>`. A missing or misspelled key in es/fr/de is a
 * COMPILE ERROR, not a silent fall-back to English. This is the guard against the
 * failure mode that matters most here: a half-translated screen.
 *
 * `t()` is safe to call from non-React code (`domain/copy.ts` is a plain module
 * and its unit tests call it outside React). The provider re-renders the tree on
 * a locale change, and because lookups happen during render the whole UI updates
 * from one state change.
 */

import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { de } from "./locales/de";

/** Every translatable string key. Derived from English so it cannot drift. */
export type MessageKey = keyof typeof en;

/** A locale dictionary: every key present, no more. */
export type Dictionary = Record<MessageKey, string>;

export const LOCALES = { en, es, fr, de } satisfies Record<string, Dictionary>;

/** The four shipped locales, in switcher order. */
export const LOCALE_CODES = ["en", "es", "fr", "de"] as const;
export type Locale = (typeof LOCALE_CODES)[number];

/**
 * Endonyms: each language is labelled in ITSELF.
 *
 * A switcher showing "Spanish" to someone who only reads Spanish is useless, so
 * these are never translated. "English" stays English by convention.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

/** BCP-47 tag written to <html lang>, for fonts and screen readers. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
};

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "climateclaim.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

/**
 * Pick the best supported locale for `navigator.languages`.
 *
 * Matches on the primary subtag, so `es-419` and `es-MX` both resolve to `es`.
 * Returns the default when nothing matches, rather than guessing.
 */
export function negotiateLocale(candidates: readonly string[]): Locale {
  for (const raw of candidates) {
    if (!raw) continue;
    if (isLocale(raw)) return raw;
    const primary = raw.split("-")[0]?.toLowerCase();
    const match = LOCALE_CODES.find((code) => code === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/**
 * Read a `?lang=` parameter from a query string. Returns null when the
 * parameter is absent or not one of the supported locales, so the caller can
 * fall through to the stored preference and the browser languages.
 */
export function localeFromSearch(search: string): Locale | null {
  const raw = new URLSearchParams(search).get("lang");
  return isLocale(raw) ? raw : null;
}

/**
 * Return `href` with `?lang=<locale>` set, preserving every other parameter
 * and the hash. Used with history.replaceState so a shared URL carries the
 * language on screen without adding a history entry.
 */
export function withLocaleParam(href: string, locale: Locale): string {
  const url = new URL(href);
  url.searchParams.set("lang", locale);
  return url.toString();
}

/** The active locale. Module state, so non-React callers can translate. */
let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return current;
}

/** Set the active locale and mirror it onto <html lang>. */
export function setLocale(locale: Locale): void {
  current = locale;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", LOCALE_HTML_LANG[locale]);
  }
}

/** Interpolation values, e.g. `t("nav.chain", { id: 61999 })`. */
export type Vars = Record<string, string | number>;

/**
 * Replace `{name}` placeholders. Unknown placeholders are left verbatim so a
 * missing value is visible during review instead of rendering as "".
 */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Translate a key for the active locale.
 *
 * Falls back to English if a key is somehow missing at runtime (possible only
 * if a dictionary is mutated, since the types prevent it) and, in development,
 * warns so the gap is caught rather than shipped.
 */
export function t(key: MessageKey, vars?: Vars): string {
  const value = LOCALES[current]?.[key] ?? en[key];
  if (value === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing message key: ${String(key)}`);
    return String(key);
  }
  return interpolate(value, vars);
}