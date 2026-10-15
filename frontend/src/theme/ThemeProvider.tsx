import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  nextPreference,
  readStoredPreference,
  resolveTheme,
  systemPrefersDark,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

interface ThemeContextValue {
  /** What the user chose: system | light | dark. */
  preference: ThemePreference;
  /** What is actually painted after resolving "system". */
  theme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** Step system -> light -> dark -> system, for the single-button toggle. */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies `data-theme` on <html>. CSS owns the actual palette, so this only
 * flips the attribute and lets the stylesheet do the work.
 */
function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(typeof window === "undefined" ? undefined : window.localStorage),
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  // Follow the OS while the preference is "system". A dedicated listener keeps
  // the app correct if the user flips their OS theme without reloading.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    writeStoredPreference(pref, typeof window === "undefined" ? undefined : window.localStorage);
  }, []);

  const cycle = useCallback(() => {
    setPreference(nextPreference(preference));
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, cycle }),
    [preference, theme, setPreference, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}