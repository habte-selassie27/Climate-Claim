import { describe, expect, it } from "vitest";
import { localeFromSearch, withLocaleParam } from "./index";

/**
 * Shareable-language helpers (item 12): `?lang=` decides the initial locale,
 * and every locale change writes it back into the URL. These are pure string
 * functions so the precedence rules are pinned without a browser.
 */
describe("localeFromSearch", () => {
  it("reads a supported ?lang= from a query string", () => {
    expect(localeFromSearch("?lang=fr")).toBe("fr");
    expect(localeFromSearch("?a=1&lang=de&b=2")).toBe("de");
  });

  it("returns null when the parameter is absent or unsupported", () => {
    expect(localeFromSearch("")).toBeNull();
    expect(localeFromSearch("?lang=it")).toBeNull();
    expect(localeFromSearch("?lang=")).toBeNull();
  });

  it("is strict about case variants rather than guessing", () => {
    // isLocale only accepts the exact shipped codes; "FR" falls through to the
    // stored preference / browser languages instead of being coerced.
    expect(localeFromSearch("?lang=FR")).toBeNull();
  });
});

describe("withLocaleParam", () => {
  it("adds the parameter to a URL that has none", () => {
    expect(withLocaleParam("https://example.org/claims", "es")).toBe(
      "https://example.org/claims?lang=es",
    );
  });

  it("preserves every other parameter and the hash", () => {
    const out = withLocaleParam("https://example.org/demo?scenario=conflict&x=1#top", "de");
    const url = new URL(out);
    expect(url.searchParams.get("scenario")).toBe("conflict");
    expect(url.searchParams.get("x")).toBe("1");
    expect(url.searchParams.get("lang")).toBe("de");
    expect(url.hash).toBe("#top");
  });

  it("replaces an existing lang instead of duplicating it", () => {
    const out = withLocaleParam("https://example.org/demo?lang=fr&scenario=a", "en");
    const url = new URL(out);
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.getAll("lang")).toEqual(["en"]);
    expect(url.searchParams.get("scenario")).toBe("a");
  });

  it("round-trips through localeFromSearch", () => {
    const out = withLocaleParam("https://example.org/", "de");
    expect(localeFromSearch(new URL(out).search)).toBe("de");
  });
});
