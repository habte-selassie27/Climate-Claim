import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_LABELS,
  isLocale,
  negotiateLocale,
  setLocale,
  t,
} from "./index";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { decisionCopy, mapError, stateCopy, policySentence } from "../domain/copy";

const DICT = { en, es, fr, de } as const;

describe("locale catalogue", () => {
  it("ships exactly the four documented locales", () => {
    expect([...LOCALE_CODES]).toEqual(["en", "es", "fr", "de"]);
  });

  it("gives every locale a value for every key", () => {
    // The type system already enforces this; this guards against a dictionary
    // being mutated at runtime or replaced by a JS consumer.
    for (const code of LOCALE_CODES) {
      const missing = Object.keys(en).filter((k) => !(k in DICT[code]));
      expect(missing).toEqual([]);
    }
  });

  it("has no empty translations", () => {
    for (const code of LOCALE_CODES) {
      const blank = Object.entries(DICT[code])
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => k);
      expect(blank).toEqual([]);
    }
  });

  it("keeps the same placeholders in every locale as English", () => {
    // A translation that drops {name} renders the literal brace text to a user,
    // and the types cannot catch it.
    const names = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const code of LOCALE_CODES) {
      if (code === "en") continue;
      for (const [key, value] of Object.entries(en)) {
        const translated = DICT[code][key as keyof typeof en] as string;
        expect(`${code}:${key} ${names(translated).join()}`).toBe(
          `${code}:${key} ${names(value).join()}`,
        );
      }
    }
  });

  it("labels each language in itself", () => {
    // A switcher showing "Spanish" to a Spanish-only reader is useless.
    expect(LOCALE_LABELS.es).toBe("Español");
    expect(LOCALE_LABELS.fr).toBe("Français");
    expect(LOCALE_LABELS.de).toBe("Deutsch");
    expect(LOCALE_LABELS.en).toBe("English");
  });

  it("actually differs from English in every non-English locale", () => {
    for (const code of LOCALE_CODES) {
      if (code === "en") continue;
      const untranslated = Object.keys(en).filter(
        (k) => DICT[code][k as keyof typeof en] === en[k as keyof typeof en],
      );
      // Some keys legitimately match (brand names, symbols, "Claim").
      // A wholesale match would mean the file was never translated.
      expect(untranslated.length).toBeLessThan(Object.keys(en).length / 2);
    }
  });
});

describe("negotiateLocale", () => {
  it("matches an exact tag", () => {
    expect(negotiateLocale(["fr"])).toBe("fr");
  });

  it("falls back to the primary subtag", () => {
    expect(negotiateLocale(["es-419"])).toBe("es");
    expect(negotiateLocale(["de-AT"])).toBe("de");
  });

  it("prefers an earlier supported language in the list", () => {
    expect(negotiateLocale(["it", "pt", "de", "en"])).toBe("de");
  });

  it("returns the default when nothing matches", () => {
    expect(negotiateLocale(["ja", "zh"])).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale([])).toBe(DEFAULT_LOCALE);
  });

  it("ignores empty entries", () => {
    expect(negotiateLocale(["", "es"])).toBe("es");
  });
});

describe("isLocale", () => {
  it("rejects unknown codes", () => {
    expect(isLocale("it")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("es")).toBe(true);
  });
});

describe("t", () => {
  it("substitutes named placeholders", () => {
    setLocale("en");
    expect(t("common.chain", { id: 61999 })).toBe("chain 61999");
  });

  it("leaves an unknown placeholder verbatim rather than blanking it", () => {
    // Visible during review beats an empty gap in production copy.
    setLocale("en");
    expect(t("common.chain")).toContain("{");
  });

  it("translates the same key differently per locale", () => {
    setLocale("en");
    const english = t("common.yes");
    setLocale("de");
    const german = t("common.yes");
    setLocale("en");
    expect(english).toBe("yes");
    expect(german).toBe("ja");
    expect(german).not.toBe(english);
  });
});

describe("domain copy follows the active locale", () => {
  it("renders decisions in the chosen language", () => {
    setLocale("en");
    expect(decisionCopy("confirmed").label).toBe("Condition confirmed");
    setLocale("es");
    expect(decisionCopy("confirmed").label).toBe("Condición confirmada");
    setLocale("fr");
    expect(decisionCopy("confirmed").label).toBe("Condition confirmée");
    setLocale("de");
    expect(decisionCopy("confirmed").label).toBe("Bedingung bestätigt");
    setLocale("en");
  });

  it("renders claim states in the chosen language", () => {
    setLocale("en");
    expect(stateCopy("settled").label).toBe("Settled");
    setLocale("fr");
    expect(stateCopy("settled").label).toBe("Réglée");
    setLocale("en");
  });

  it("maps contract error prefixes identically in every locale", () => {
    for (const code of LOCALE_CODES) {
      setLocale(code);
      expect(mapError("EXTERNAL: sources unreachable").action).toBe("retry");
      expect(mapError("EXPECTED: nope").action).toBe("fix");
      expect(mapError("LLM_ERROR: x").message.length).toBeGreaterThan(0);
    }
    setLocale("en");
  });

  it("builds the policy sentence in the chosen language, keeping the numbers", () => {
    const args = {
      location_name: "London",
      comparator: "gt",
      threshold_scaled: 150,
      unit: "mm",
      aggregation: "max_single",
      period_start: "2024-06-01",
      period_end: "2024-06-05",
      source_ids: ["om_archive_precip"],
    };
    setLocale("en");
    const english = policySentence(args);
    setLocale("de");
    const german = policySentence(args);
    setLocale("en");

    expect(english).not.toBe(german);
    for (const s of [english, german]) {
      expect(s).toContain("London");
      expect(s).toContain("1.50");
      expect(s).toContain("2024-06-01");
    }
    // No un-substituted placeholder may survive into user-facing copy.
    expect(english).not.toContain("{");
    expect(german).not.toContain("{");
  });
});