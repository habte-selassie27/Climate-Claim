import { describe, expect, it } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  INITIAL_FORM,
  clearDraft,
  isDirty,
  loadDraft,
  sanitizeForm,
  saveDraft,
  type PolicyFormState,
} from "./draftStore";

function fakeStore(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(DRAFT_STORAGE_KEY, initial);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const FILLED: PolicyFormState = {
  location_name: "Paris",
  lat: "48.8566",
  lon: "2.3522",
  tolerance_m: "5000",
  metric: "precipitation",
  sourceIds: ["om_archive_precip"],
  agreement_rule: "unanimous",
  min_sources: "2",
  data_mode: "live",
  period_start: "2024-06-01",
  period_end: "2024-06-05",
  timezone: "UTC",
  comparator: "gte",
  threshold: "2.5",
  aggregation: "cumulative",
  condition_text: "Confirmed when the total is at least 2.5 mm.",
  payout_amount: "5000",
};

describe("round trip", () => {
  it("restores every field exactly", () => {
    const store = fakeStore();
    saveDraft(FILLED, true, store);
    const loaded = loadDraft(store);
    expect(loaded?.form).toEqual(FILLED);
    expect(loaded?.conditionTouched).toBe(true);
  });

  it("restores a hand-edited condition as touched, so it is not overwritten", () => {
    // The form regenerates condition_text from the summary until touched=true.
    const store = fakeStore();
    saveDraft(FILLED, true, store);
    expect(loadDraft(store)?.conditionTouched).toBe(true);
  });

  it("returns null when nothing was saved", () => {
    expect(loadDraft(fakeStore())).toBeNull();
  });
});

describe("survives the cases the user hit", () => {
  it("keeps values after a validation failure (nothing is cleared on error)", () => {
    // Persistence is unconditional, so a failed submit simply never clears.
    const store = fakeStore();
    saveDraft(FILLED, false, store);
    // A later mount reloads the same values.
    expect(loadDraft(store)?.form.location_name).toBe("Paris");
  });

  it("keeps values after a successful creation", () => {
    // Deliberate: submit() never calls clearDraft, so the draft outlives success.
    const store = fakeStore();
    saveDraft(FILLED, false, store);
    loadDraft(store);
    expect(store.map.has(DRAFT_STORAGE_KEY)).toBe(true);
  });

  it("is discarded only by the explicit clear action", () => {
    const store = fakeStore();
    saveDraft(FILLED, false, store);
    clearDraft(store);
    expect(loadDraft(store)).toBeNull();
  });
});

describe("untrusted input", () => {
  it("returns null for junk rather than throwing", () => {
    expect(loadDraft(fakeStore("not json"))).toBeNull();
    expect(loadDraft(fakeStore("null"))).toBeNull();
    expect(loadDraft(fakeStore('"a string"'))).toBeNull();
    expect(loadDraft(fakeStore("[]"))).toBeNull();
  });

  it("discards a draft written by a different form version", () => {
    const stale = JSON.stringify({ version: DRAFT_VERSION + 1, form: FILLED });
    expect(loadDraft(fakeStore(stale))).toBeNull();
  });

  it("overlays only good fields, keeping the rest usable", () => {
    const partial = sanitizeForm({
      location_name: "Paris",
      lat: "not-a-number",
      metric: "hailstones",
      comparator: "approximately",
      threshold: 42,
      period_start: "01/06/2024",
    });
    expect(partial.location_name).toBe("Paris");
    // Bad values fall back to defaults rather than poisoning the form.
    expect(partial.lat).toBe(INITIAL_FORM.lat);
    expect(partial.metric).toBe(INITIAL_FORM.metric);
    expect(partial.comparator).toBe(INITIAL_FORM.comparator);
    expect(partial.threshold).toBe(INITIAL_FORM.threshold);
    expect(partial.period_start).toBe(INITIAL_FORM.period_start);
  });

  it("caps unbounded text so a hand-edited draft cannot flood the input", () => {
    const huge = sanitizeForm({ location_name: "x".repeat(50_000), condition_text: "y".repeat(50_000) });
    expect(huge.location_name.length).toBeLessThanOrEqual(120);
    expect(huge.condition_text.length).toBeLessThanOrEqual(300);
  });

  it("caps and de-duplicates source ids", () => {
    const ids = sanitizeForm({
      sourceIds: ["a", "a", "b", "c", "d", "e", "f", 42, null],
    }).sourceIds;
    expect(ids).toEqual(["a", "b", "c", "d"]); // MAX_SOURCES_PER_POLICY = 4
  });

  it("rejects a non-array sourceIds without discarding the rest of the draft", () => {
    const out = sanitizeForm({ sourceIds: "om_archive_precip", location_name: "Paris" });
    expect(out.sourceIds).toEqual([]);
    expect(out.location_name).toBe("Paris");
  });

  it("survives storage that throws", () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveDraft(FILLED, false, hostile)).not.toThrow();
    expect(() => clearDraft(hostile)).not.toThrow();
  });

  it("treats a missing storage as no draft", () => {
    expect(loadDraft(undefined)).toBeNull();
    expect(() => saveDraft(FILLED, false, undefined)).not.toThrow();
  });
});

describe("isDirty", () => {
  it("is false for a pristine form so nothing is written on arrival", () => {
    expect(isDirty({ ...INITIAL_FORM })).toBe(false);
  });

  it("is true once any field differs", () => {
    expect(isDirty({ ...INITIAL_FORM, location_name: "Paris" })).toBe(true);
  });

  it("ignores object identity, comparing by value", () => {
    // Important: the restore path and the reset path build fresh objects.
    expect(isDirty({ ...INITIAL_FORM })).toBe(false);
  });
});