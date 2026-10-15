/**
 * Theme preference logic. Pure and DOM-free so it can be unit tested.
 *
 * Three preference states, not two: "system" follows the OS preference and
 * keeps following it if the user changes it mid-session, while an explicit
 * light/dark choice overrides the OS and sticks.
 *
 * The RESOLVED theme (what is actually painted) is applied to the document as
 * `data-theme`. See `ThemeProvider.tsx`.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "climateclaim.theme";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Collapse a preference plus the OS setting into the theme to paint.
 *
 * `prefersDark` is passed in rather than read from `window` so this stays pure
 * and testable; the caller reads `matchMedia`.
 */
export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (pref === "system") return prefersDark ? "dark" : "light";
  return pref;
}

/** Cycle order for the toggle: system -> light -> dark -> system. */
export function nextPreference(pref: ThemePreference): ThemePreference {
  const i = THEME_PREFERENCES.indexOf(pref);
  return THEME_PREFERENCES[(i + 1) % THEME_PREFERENCES.length]!;
}

/**
 * Read a stored preference.
 *
 * Returns "system" for anything missing or unrecognised rather than throwing:
 * a corrupt localStorage entry must not stop the app from rendering, and
 * "system" is the honest default because it follows the user's OS.
 */
export function readStoredPreference(storage?: Pick<Storage, "getItem">): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    // Private mode / blocked storage. Fall through to the default.
    return "system";
  }
}

/** Persist a preference. Silently ignores a storage failure (quota, private mode). */
export function writeStoredPreference(
  pref: ThemePreference,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* Preference stays in memory for this session only. */
  }
}

/** Current OS-level dark preference, defaulting to light where matchMedia is absent. */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}