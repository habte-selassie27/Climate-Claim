import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  getLocale,
  isLocale,
  localeFromSearch,
  LOCALE_STORAGE_KEY,
  negotiateLocale,
  setLocale as applyLocale,
  t as translate,
  withLocaleParam,
  type Locale,
  type MessageKey,
  type Vars,
} from "./index";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Bound to the active locale so components do not need to import `t`. */
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Precedence: a supported `?lang=` parameter, then the stored preference, then
 * the browser's languages. The URL wins because that is the whole point of a
 * shared link — a colleague opens a French claim and gets French, even if
 * their own preference is English. Guards storage access: private mode throws
 * on setItem/getItem in some browsers.
 */
function initialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const fromUrl = localeFromSearch(window.location.search);
    if (fromUrl) return fromUrl;
  } catch {
    /* fall through to the stored preference */
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* fall through to negotiation */
  }
  const preferred = window.navigator?.languages?.length
    ? window.navigator.languages
    : [window.navigator?.language ?? ""];
  return negotiateLocale(preferred);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* choice holds for this session only */
    }
    // Mirror the choice into ?lang= with replaceState: the current URL becomes
    // shareable in the language on screen, and no history entry is added.
    // Every other parameter (e.g. the demo scenario) is preserved.
    try {
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", withLocaleParam(window.location.href, next));
      }
    } catch {
      /* URL sync is best-effort; the choice still holds in state */
    }
  }, []);

  // Module `t` reads the module-level locale, which `applyLocale` keeps in step
  // with React state. Rebinding on each locale change guarantees a re-render
  // whenever the dictionary in use actually changes.
  //
  // This useCallback MUST sit at the top level, not inside the useMemo below:
  // a hook called from within a memo violates the rules of hooks and React logs
  // a warning. It only became visible once a test rendered the provider.
  const t = useCallback(
    (key: MessageKey, vars?: Vars) => translate(key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Re-export so non-React modules can translate without importing the context. */
export { getLocale };
