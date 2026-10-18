/**
 * Contract enum -> plain-language copy.
 *
 * Single source of truth, per the UI spec: "Map contract enums (decision,
 * reason_code, check statuses, claim states) to UI copy in one place" and
 * "don't show raw enums". Raw enum values are never rendered to a user; they
 * are only used as lookup keys here.
 *
 * The English text now lives in `i18n/locales/en.ts` and is reached through
 * `t()`. The exported API is deliberately UNCHANGED, so the pure-function unit
 * tests in `copy.test.ts` keep working with the default (English) locale, and
 * every caller is unaffected by the move.
 *
 * `t()` reads a module-level locale, so these stay plain functions usable
 * outside React. Switching language re-renders the tree, and because the lookup
 * happens during render the whole UI updates from that one state change.
 *
 * Copy rules followed: sentence case, active voice, addressed to a policy
 * holder. "Confirmed" means the evidence met the policy's terms - it is not a
 * statement that a legal claim is payable.
 */

import type {
  CheckName,
  CheckStatus,
  ClaimState,
  Decision,
  DataMode,
  ReasonCode,
  SettlementState,
} from "./types";
import { fromScaled } from "./format";
import { t } from "../i18n";

// --- decisions -------------------------------------------------------------

export interface DecisionCopy {
  /** Short label for the decision block. */
  label: string;
  /** One-line plain-language sentence. */
  sentence: string;
  tone: "confirmed" | "not-confirmed" | "inconclusive";
}

export function decisionCopy(decision: Decision | ""): DecisionCopy {
  switch (decision) {
    case "confirmed":
      return {
        label: t("decision.confirmed.label"),
        sentence: t("decision.confirmed.sentence"),
        tone: "confirmed",
      };
    case "not_confirmed":
      return {
        label: t("decision.notConfirmed.label"),
        sentence: t("decision.notConfirmed.sentence"),
        tone: "not-confirmed",
      };
    case "inconclusive":
      return {
        label: t("decision.inconclusive.label"),
        sentence: t("decision.inconclusive.sentence"),
        tone: "inconclusive",
      };
    default:
      return {
        label: t("decision.none.label"),
        sentence: t("decision.none.sentence"),
        tone: "inconclusive",
      };
  }
}

// --- reason codes ----------------------------------------------------------

export interface ReasonCopy {
  /** Plain-language reason. */
  text: string;
  /** For inconclusive: what could resolve it. */
  resolve?: string;
}

export function reasonCopy(reason: ReasonCode | ""): ReasonCopy {
  switch (reason) {
    case "threshold_crossed":
      return { text: t("reason.thresholdCrossed") };
    case "threshold_not_crossed":
      return { text: t("reason.thresholdNotCrossed") };
    case "source_conflict":
      return {
        text: t("reason.sourceConflict"),
        resolve: t("reason.sourceConflict.resolve"),
      };
    case "missing_observations":
      return {
        text: t("reason.missingObservations"),
        resolve: t("reason.missingObservations.resolve"),
      };
    case "location_mismatch":
      return {
        text: t("reason.locationMismatch"),
        resolve: t("reason.locationMismatch.resolve"),
      };
    case "sources_unreachable":
      return {
        text: t("reason.sourcesUnreachable"),
        resolve: t("reason.sourcesUnreachable.resolve"),
      };
    default:
      return { text: t("reason.none") };
  }
}

// --- checks ----------------------------------------------------------------

const CHECK_LABEL_KEY = {
  threshold_crossed: "check.thresholdCrossed.label",
  period_covered: "check.periodCovered.label",
  location_match: "check.locationMatch.label",
  source_agreement: "check.sourceAgreement.label",
  data_completeness: "check.dataCompleteness.label",
} as const satisfies Record<CheckName, string>;

const CHECK_BLURB_KEY = {
  threshold_crossed: "check.thresholdCrossed.blurb",
  period_covered: "check.periodCovered.blurb",
  location_match: "check.locationMatch.blurb",
  source_agreement: "check.sourceAgreement.blurb",
  data_completeness: "check.dataCompleteness.blurb",
} as const satisfies Record<CheckName, string>;

export function checkLabel(name: CheckName): string {
  const key = CHECK_LABEL_KEY[name];
  // Falls back to the raw name for an enum value this build does not know.
  return key ? t(key) : name;
}

export function checkBlurb(name: CheckName): string {
  const key = CHECK_BLURB_KEY[name];
  return key ? t(key) : "";
}

export function checkStatusText(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return t("check.status.pass");
    case "fail":
      return t("check.status.fail");
    default:
      return t("check.status.unclear");
  }
}

/** Icon glyph so status is never conveyed by colour alone. Not translated. */
export function checkStatusIcon(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "✓";
    case "fail":
      return "✕";
    default:
      return "?";
  }
}

// --- claim states ----------------------------------------------------------

export interface StateCopy {
  label: string;
  /** Plain-language description of what this state means. */
  blurb: string;
}

const STATE_KEY = {
  created: "state.created",
  pending_evaluation: "state.pendingEvaluation",
  evidence_collected: "state.evidenceCollected",
  decided_confirmed: "state.decidedConfirmed",
  decided_not_confirmed: "state.decidedNotConfirmed",
  inconclusive: "state.inconclusive",
  disputed: "state.disputed",
  settled: "state.settled",
} as const satisfies Record<Exclude<ClaimState, "">, string>;

export function stateCopy(state: ClaimState | ""): StateCopy {
  const base = state ? STATE_KEY[state] : undefined;
  if (!base) {
    return { label: t("state.unknown.label"), blurb: t("state.unknown.blurb") };
  }
  return { label: t(`${base}.label`), blurb: t(`${base}.blurb`) };
}

// --- settlement ------------------------------------------------------------

export function settlementCopy(state: SettlementState | ""): string {
  switch (state) {
    case "not_settled":
      return t("settlement.notSettled");
    case "payout_emitted":
      // Deliberately not "settling" or "paid": the message is out, delivery is
      // not verified. See the contract's confirm_settlement docstring.
      return t("settlement.payoutEmitted");
    case "settled":
      return t("settlement.settled");
    case "settlement_failed":
      return t("settlement.failed");
    default:
      return t("settlement.unknown");
  }
}

// --- data mode -------------------------------------------------------------

export function dataModeCopy(mode: DataMode | ""): {
  label: string;
  blurb: string;
} {
  if (mode === "live") {
    return { label: t("datamode.live.label"), blurb: t("datamode.live.blurb") };
  }
  return {
    label: t("datamode.historical.label"),
    blurb: t("datamode.historical.blurb"),
  };
}

/** Glyph only, so it is identical across locales. */
export function dataModeIcon(mode: DataMode | ""): string {
  return mode === "live" ? "◉" : "▤";
}

// --- aggregation / comparator ---------------------------------------------

const AGGREGATION_KEY = {
  max_single: "agg.maxSingle",
  cumulative: "agg.cumulative",
  consecutive_days: "agg.consecutiveDays",
} as const;

export function aggregationText(agg: string): string {
  const key = AGGREGATION_KEY[agg as keyof typeof AGGREGATION_KEY];
  return key ? t(key) : agg;
}

const COMPARATOR_KEY = {
  gt: "cmp.gt",
  gte: "cmp.gte",
  lt: "cmp.lt",
  lte: "cmp.lte",
} as const;

export function comparatorText(cmp: string): string {
  const key = COMPARATOR_KEY[cmp as keyof typeof COMPARATOR_KEY];
  return key ? t(key) : cmp;
}

/** Mathematical symbols, identical in every locale. */
const COMPARATOR_SYMBOL: Record<string, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

export function comparatorSymbol(cmp: string): string {
  return COMPARATOR_SYMBOL[cmp] ?? cmp;
}

/**
 * The one-sentence policy summary the user confirms instead of raw fields.
 * Mirrors the contract's own `condition_text` intent.
 *
 * The sentence is assembled through `t()` with named placeholders rather than by
 * concatenation, because word order differs between the four shipped locales.
 */
export function policySentence(params: {
  location_name: string;
  comparator: string;
  threshold_scaled: number;
  unit: string;
  aggregation: string;
  period_start: string;
  period_end: string;
  source_ids: string[];
}): string {
  let sources: string;
  if (params.source_ids.length === 0) {
    sources = t("policy.sources.none");
  } else if (params.source_ids.length === 1) {
    sources = params.source_ids[0]!;
  } else {
    sources = t("policy.sources.two", {
      first: params.source_ids.slice(0, -1).join(", "),
      last: params.source_ids[params.source_ids.length - 1]!,
    });
  }
  // Use the shared scaled-integer formatter so a 1.00 mm threshold never reads
  // as "1 mm". Threshold is stored scaled by 100.
  const threshold = fromScaled(params.threshold_scaled);
  return t("policy.sentence", {
    aggregation: aggregationText(params.aggregation),
    location: params.location_name,
    comparator: comparatorText(params.comparator),
    threshold,
    unit: params.unit,
    start: params.period_start,
    end: params.period_end,
    sources,
  });
}

// --- errors ----------------------------------------------------------------

export interface ErrorMapping {
  message: string;
  action: "fix" | "retry";
  retryLabel?: string;
}

/**
 * Stable contract error prefixes -> actionable user message.
 * Errors say what happened and what to do. No apologies, no "something went
 * wrong", never raw model output.
 */
export function mapError(error: string): ErrorMapping {
  const raw = error.trim();
  if (!raw) {
    return { message: t("error.empty"), action: "retry", retryLabel: t("common.retry") };
  }
  const [prefix = "", ...rest] = raw.split(":");
  const reason = rest.join(":").trim();
  const head = prefix.trim().toUpperCase();

  if (head === "EXPECTED") {
    return { message: reason || t("error.expected"), action: "fix" };
  }
  if (head === "EXTERNAL") {
    return {
      message: t("error.external"),
      action: "retry",
      retryLabel: t("common.retry"),
    };
  }
  if (head === "TRANSIENT") {
    return {
      message: t("error.transient"),
      action: "retry",
      retryLabel: t("common.retry"),
    };
  }
  if (head === "LLM_ERROR") {
    return { message: t("error.llm"), action: "retry", retryLabel: t("common.retry") };
  }
  if (head === "EXECUTION") {
    return { message: t("error.execution"), action: "fix" };
  }
  return {
    message: t("error.generic"),
    action: "retry",
    retryLabel: t("common.retry"),
  };
}

/** The raw stable error string, for the "Details" disclosure only. */
export function errorDetail(error: string): string {
  return error.trim();
}