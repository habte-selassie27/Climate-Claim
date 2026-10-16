/**
 * Draft persistence for the Create-a-policy form.
 *
 * WHY: creating a policy is a multi-step write to a chain. The user types a
 * location, coordinates, a threshold, picks sources, and only then discovers
 * they need the owner account or must switch networks. Losing the whole form to a
 * refresh at that point is punishing, so the draft is kept across:
 *
 *   - navigation away and back (client-side routing)
 *   - refresh and hard reload
 *   - a validation failure, a wallet/ownership gate, or a failed transaction
 *   - a SUCCESSFUL creation (deliberately not cleared -- see the note below)
 *
 * WHY A MODULE AND NOT INLINE localStorage: restoring is the risky half. A draft
 * is untrusted input -- it may be from an older version of the form, hand-edited,
 * or truncated. `sanitizeForm` therefore overlays only the fields that pass
 * validation onto INITIAL, so a corrupt draft degrades to a usable form instead
 * of crashing the page or sending nonsense to the contract.
 *
 * NOTHING SECRET IS STORED. The form holds no key material; writes always go
 * through a wallet the page never sees.
 */

import type { DataMode } from "./types";

export const DRAFT_STORAGE_KEY = "climateclaim.policyDraft";

/**
 * Bump when the form shape changes incompatibly. A draft written by an older
 * build is then discarded rather than half-restored into a field that no longer
 * means what it used to.
 */
export const DRAFT_VERSION = 1;

export interface PolicyFormState {
  location_name: string;
  lat: string;
  lon: string;
  tolerance_m: string;
  metric: string;
  sourceIds: string[];
  agreement_rule: string;
  min_sources: string;
  data_mode: DataMode;
  period_start: string;
  period_end: string;
  timezone: string;
  comparator: string;
  threshold: string;
  aggregation: string;
  condition_text: string;
  payout_amount: string;
}

export interface Draft {
  version: number;
  form: PolicyFormState;
  /** Saved so a hand-edited condition sentence is not overwritten on restore. */
  conditionTouched: boolean;
}

/** Mirrors PolicyNew's INITIAL. Kept here so restore needs no page import. */
export const INITIAL_FORM: PolicyFormState = {
  location_name: "",
  lat: "",
  lon: "",
  tolerance_m: "10000",
  metric: "precipitation",
  sourceIds: [],
  agreement_rule: "majority",
  min_sources: "1",
  data_mode: "historical_simulation",
  period_start: "",
  period_end: "",
  timezone: "UTC",
  comparator: "gt",
  threshold: "",
  aggregation: "max_single",
  condition_text: "",
  payout_amount: "0",
};

// Mirrors of the contract-accepted values in PolicyNew.tsx.
const METRICS = ["precipitation", "temperature"];
const COMPARATORS = ["gt", "gte", "lt", "lte"];
const AGREEMENT_RULES = ["unanimous", "majority", "any"];
const AGGREGATIONS = ["max_single", "cumulative", "consecutive_days"];
const DATA_MODES: DataMode[] = ["historical_simulation", "live"];
/** MAX_SOURCES_PER_POLICY on the contract. */
const MAX_SOURCES = 4;
/** MAX_CONDITION_CHARS on the contract. */
const MAX_CONDITION_CHARS = 300;

const NUM_RE = /^-?\d+(\.\d+)?$/;
const INT_RE = /^\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upper bounds for free-text fields. A draft is user-writable, so lengths are
 * capped here as well as at submit: without this, a hand-edited 10 MB
 * location_name would be restored into a controlled input.
 */
const LIMITS = {
  location_name: 120,
  lat: 32,
  lon: 32,
  tolerance_m: 12,
  min_sources: 6,
  timezone: 64,
  threshold: 32,
  payout_amount: 48,
} as const;

type TextKey = keyof typeof LIMITS;

/** A plain short string within its cap; anything else falls back to default. */
function str(value: unknown, key: TextKey, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.length <= LIMITS[key] ? value : value.slice(0, LIMITS[key]);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function numText(value: unknown, re: RegExp, fallback: string): string {
  return typeof value === "string" && re.test(value) ? value : fallback;
}

function dateText(value: unknown, fallback: string): string {
  return typeof value === "string" && DATE_RE.test(value) ? value : fallback;
}

/**
 * Overlay a raw draft onto INITIAL, keeping only fields that pass validation.
 *
 * Deliberately forgiving per field: one bad value must not discard the other
 * fifteen, which is the whole point of persisting the draft.
 */
export function sanitizeForm(raw: unknown): PolicyFormState {
  const base = INITIAL_FORM;
  if (typeof raw !== "object" || raw === null) return { ...base };
  const f = raw as Record<string, unknown>;

  let sourceIds = base.sourceIds;
  if (Array.isArray(f.sourceIds)) {
    const seen = new Set<string>();
    sourceIds = f.sourceIds
      .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 80)
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
      .slice(0, MAX_SOURCES);
  }

  let condition = "";
  if (typeof f.condition_text === "string") {
    condition = f.condition_text.slice(0, MAX_CONDITION_CHARS);
  }

  return {
    location_name: str(f.location_name, "location_name", base.location_name),
    lat: numText(f.lat, NUM_RE, base.lat),
    lon: numText(f.lon, NUM_RE, base.lon),
    tolerance_m: numText(f.tolerance_m, INT_RE, base.tolerance_m),
    metric: oneOf(f.metric, METRICS, base.metric),
    sourceIds,
    agreement_rule: oneOf(f.agreement_rule, AGREEMENT_RULES, base.agreement_rule),
    min_sources: numText(f.min_sources, INT_RE, base.min_sources),
    data_mode: oneOf(f.data_mode, DATA_MODES, base.data_mode),
    period_start: dateText(f.period_start, base.period_start),
    period_end: dateText(f.period_end, base.period_end),
    timezone: str(f.timezone, "timezone", base.timezone),
    comparator: oneOf(f.comparator, COMPARATORS, base.comparator),
    threshold: numText(f.threshold, NUM_RE, base.threshold),
    aggregation: oneOf(f.aggregation, AGGREGATIONS, base.aggregation),
    condition_text: condition,
    payout_amount: numText(f.payout_amount, INT_RE, base.payout_amount),
  };
}

/** True when the restored form differs from a blank one. */
export function isDirty(form: PolicyFormState): boolean {
  return JSON.stringify(form) !== JSON.stringify(INITIAL_FORM);
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    // Blocked storage (private mode, strict privacy settings).
    return undefined;
  }
}

/** Read and validate a draft, or null when absent/unusable/out-of-date. */
export function loadDraft(store: StorageLike | undefined = storage()): Draft | null {
  if (!store) return null;
  let parsed: unknown;
  try {
    const raw = store.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;
  // An older or newer shape is discarded, not half-restored.
  if (d.version !== DRAFT_VERSION) return null;
  return {
    version: DRAFT_VERSION,
    form: sanitizeForm(d.form),
    conditionTouched: d.conditionTouched === true,
  };
}

/** Persist a draft. Silently ignores storage failures. */
export function saveDraft(
  form: PolicyFormState,
  conditionTouched: boolean,
  store: StorageLike | undefined = storage(),
): void {
  if (!store) return;
  try {
    const payload: Draft = { version: DRAFT_VERSION, form, conditionTouched };
    store.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* Quota exceeded or storage blocked: the form still works in memory. */
  }
}

/** Remove the draft. Used by the explicit "clear" action. */
export function clearDraft(store: StorageLike | undefined = storage()): void {
  if (!store) return;
  try {
    store.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}