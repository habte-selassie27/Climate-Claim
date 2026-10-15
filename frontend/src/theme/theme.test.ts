import { describe, expect, it } from "vitest";
import {
  THEME_PREFERENCES,
  isThemePreference,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
} from "./theme";

describe("resolveTheme", () => {
  it("follows the OS while the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("an explicit choice overrides the OS either way", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });
});

describe("nextPreference", () => {
  it("cycles system -> light -> dark -> system", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("returns to the starting point after a full cycle", () => {
    let p = nextPreference("system");
    expect(nextPreference(nextPreference(p))).toBe("system");
  });

  it("never leaves the three known states", () => {
    for (const p of THEME_PREFERENCES) {
      expect(THEME_PREFERENCES).toContain(nextPreference(p));
    }
  });
});

describe("isThemePreference", () => {
  it("accepts the three states and rejects junk", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });
});

describe("storage", () => {
  function fakeStore(initial?: string) {
    const map = new Map<string, string>();
    if (initial !== undefined) map.set("climateclaim.theme", initial);
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      map,
    };
  }

  it("reads back a stored preference", () => {
    expect(readStoredPreference(fakeStore("dark"))).toBe("dark");
  });

  it("falls back to system for a missing or corrupt entry", () => {
    expect(readStoredPreference(fakeStore())).toBe("system");
    expect(readStoredPreference(fakeStore("chartreuse"))).toBe("system");
    // A corrupt entry must not stop the app rendering.
    expect(readStoredPreference(undefined)).toBe("system");
  });

  it("survives a storage that throws (private mode)", () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredPreference(hostile)).toBe("system");
    expect(() => writeStoredPreference("dark", hostile)).not.toThrow();
  });

  it("round-trips a written preference", () => {
    const store = fakeStore();
    writeStoredPreference("light", store);
    expect(readStoredPreference(store)).toBe("light");
  });
});