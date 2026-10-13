/**
 * Contract enum -> plain-language copy.
 *
 * Single source of truth, per the UI spec: "Map contract enums (decision,
 * reason_code, check statuses, claim states) to UI copy in one place" and
 * "don't show raw enums". Raw enum values are never rendered to a user; they
 * are only used as lookup keys here.
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
        label: "Condition confirmed",
        sentence:
          "The recorded evidence met the terms of this policy.",
        tone: "confirmed",
      };
    case "not_confirmed":
      return {
        label: "Condition not confirmed",
        sentence: "The recorded evidence did not meet the terms of this policy.",
        tone: "not-confirmed",
      };
    case "inconclusive":
      return {
        label: "Inconclusive",
        sentence:
          "The evidence does not settle the question either way. This is a result, not an error.",
        tone: "inconclusive",
      };
    default:
      return {
        label: "Not evaluated yet",
        sentence: "This claim has no decision yet.",
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
      return {
        text: "At least one reading in the observation period met the policy's threshold.",
      };
    case "threshold_not_crossed":
      return {
        text: "No reading in the observation period met the policy's threshold.",
      };
    case "source_conflict":
      return {
        text: "The eligible sources disagreed about whether the threshold was crossed, and the policy does not define a tie-break.",
        resolve:
          "Dispute the decision with a reason if you believe one source should take precedence.",
      };
    case "missing_observations":
      return {
        text: "The evidence does not cover the whole observation period, so the threshold cannot be judged.",
        resolve:
          "Retry the evaluation later, or dispute with a source that does cover the period.",
      };
    case "location_mismatch":
      return {
        text: "The reported station is outside the distance this policy allows from the stated location.",
        resolve: "Dispute if you believe the station is in fact the right location.",
      };
    case "sources_unreachable":
      return {
        text: "None of the eligible sources could be reached, so there was nothing to evaluate.",
        resolve: "Retry the evaluation - this one is usually temporary.",
      };
    default:
      return { text: "No reason has been recorded yet." };
  }
}

// --- checks ----------------------------------------------------------------

const CHECK_LABELS: Record<CheckName, string> = {
  threshold_crossed: "Threshold crossed",
  period_covered: "Period covered",
  location_match: "Location match",
  source_agreement: "Source agreement",
  data_completeness: "Data completeness",
};

const CHECK_BLURB: Record<CheckName, string> = {
  threshold_crossed: "Whether a reading met the policy threshold.",
  period_covered: "Whether the evidence spans the whole observation period.",
  location_match: "Whether the reported station matches the policy location.",
  source_agreement: "Whether the eligible sources agreed with each other.",
  data_completeness: "Whether any observation is missing from the period.",
};

export function checkLabel(name: CheckName): string {
  return CHECK_LABELS[name] ?? name;
}

export function checkBlurb(name: CheckName): string {
  return CHECK_BLURB[name] ?? "";
}

const STATUS_TEXT: Record<CheckStatus, string> = {
  pass: "Passed",
  fail: "Failed",
  unclear: "Unclear",
};

export function checkStatusText(status: CheckStatus): string {
  return STATUS_TEXT[status] ?? "Unclear";
}

/** Icon glyph so status is never conveyed by colour alone. */
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

export function stateCopy(state: ClaimState | ""): StateCopy {
  switch (state) {
    case "created":
      return {
        label: "Created",
        blurb: "The claim exists. Evidence has not been requested yet.",
      };
    case "pending_evaluation":
      return {
        label: "Evaluating",
        blurb: "Validators are fetching the evidence and comparing results.",
      };
    case "evidence_collected":
      return {
        label: "Evidence collected",
        blurb: "The observations were retrieved. No decision has been reached yet.",
      };
    case "decided_confirmed":
      return {
        label: "Decision: confirmed",
        blurb: "A decision has been reached and accepted by validators.",
      };
    case "decided_not_confirmed":
      return {
        label: "Decision: not confirmed",
        blurb: "A decision has been reached and accepted by validators.",
      };
    case "inconclusive":
      return {
        label: "Decision: inconclusive",
        blurb: "A decision has been reached: the evidence does not settle the question.",
      };
    case "disputed":
      return {
        label: "Disputed",
        blurb: "The decision is being challenged and will be re-evaluated.",
      };
    case "settled":
      return { label: "Settled", blurb: "The payout for this claim has been made." };
    default:
      return { label: "Unknown", blurb: "This state is not recognised." };
  }
}

// --- settlement ------------------------------------------------------------

export function settlementCopy(state: SettlementState | ""): string {
  switch (state) {
    case "not_settled":
      return "Not settled";
    case "settling":
      return "Settling";
    case "settled":
      return "Settled";
    case "settlement_failed":
      return "Transfer failed - retryable";
    default:
      return "Unknown";
  }
}

// --- data mode -------------------------------------------------------------

export function dataModeCopy(mode: DataMode | ""): {
  label: string;
  blurb: string;
} {
  if (mode === "live") {
    return {
      label: "Live",
      blurb:
        "Values are fetched from the source at evaluation time. The result reflects the world now, and can change if you re-evaluate.",
    };
  }
  return {
    label: "Historical simulation",
    blurb:
      "Values are recorded historical observations, not a live feed. Re-running this claim will not change the underlying data.",
  };
}

export function dataModeIcon(mode: DataMode | ""): string {
  return mode === "live" ? "◉" : "▤";
}

// --- aggregation / comparator ---------------------------------------------

const AGGREGATION_TEXT: Record<string, string> = {
  max_single: "highest single reading on any day",
  daily_total: "total for each day",
  cumulative: "total across the whole period",
  consecutive_days: "longest run of consecutive days",
};

export function aggregationText(agg: string): string {
  return AGGREGATION_TEXT[agg] ?? agg;
}

const COMPARATOR_TEXT: Record<string, string> = {
  gt: "more than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
};

export function comparatorText(cmp: string): string {
  return COMPARATOR_TEXT[cmp] ?? cmp;
}

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
  const sources =
    params.source_ids.length === 0
      ? "no sources"
      : params.source_ids.length === 1
        ? params.source_ids[0]
        : `${params.source_ids.slice(0, -1).join(", ")} and ${params.source_ids[params.source_ids.length - 1]}`;
  // Use the shared scaled-integer formatter so a 1.00 mm threshold never reads
  // as "1 mm". Threshold is stored scaled by 100.
  const threshold = fromScaled(params.threshold_scaled);
  return `Confirmed if the ${aggregationText(params.aggregation)} at ${params.location_name} is ${comparatorText(params.comparator)} ${threshold} ${params.unit} on any day between ${params.period_start} and ${params.period_end}, using ${sources}.`;
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
    return { message: "Something did not complete.", action: "retry", retryLabel: "Try again" };
  }
  const [prefix = "", ...rest] = raw.split(":");
  const reason = rest.join(":").trim();
  const head = prefix.trim().toUpperCase();

  if (head === "EXPECTED") {
    return { message: reason || "That request is not allowed.", action: "fix" };
  }
  if (head === "EXTERNAL") {
    return {
      message: "A data source could not be reached, so there was nothing to evaluate.",
      action: "retry",
      retryLabel: "Try again",
    };
  }
  if (head === "TRANSIENT") {
    return {
      message: "There was a temporary problem on the network.",
      action: "retry",
      retryLabel: "Try again",
    };
  }
  if (head === "LLM_ERROR") {
    return {
      message: "The evaluation could not be completed.",
      action: "retry",
      retryLabel: "Try again",
    };
  }
  return {
    message: "That action could not be completed.",
    action: "retry",
    retryLabel: "Try again",
  };
}

/** The raw stable error string, for the "Details" disclosure only. */
export function errorDetail(error: string): string {
  return error.trim();
}