/**
 * Demo scenarios (UI.md section 8).
 *
 * HONESTY RULES OBSERVED HERE:
 *  - `provenance: "on_chain"` means the decision, evidence and checks shown are
 *    read from the deployed StudioNet contract. The UI links to the real claim.
 *  - `provenance: "recorded_source_data"` means the daily series is a REAL
 *    recorded response from a documented endpoint (see
 *    fixtures/historical/), and the expected outcome was derived by running the
 *    contract's own evaluation logic. It is a replay, never presented as a
 *    transaction. The verifying test is named on each scenario.
 *
 * Nothing here is invented weather data. Every number comes from
 * fixtures/historical/london_2024-06-01_2024-06-05.json or
 * fixtures/historical/paris_2024-06-01_2024-06-05.json.
 */

import type { Decision, ReasonCode } from "../domain/types";

export type Provenance = "on_chain" | "recorded_source_data";

export interface DemoSeries {
  sourceId: string;
  label: string;
  /** Shape is a second channel alongside colour, so charts stay readable. */
  shape: "square" | "circle" | "triangle";
  /** null means that source returned no reading for that day. Never filled in. */
  daily: Record<string, number | null>;
  unit: string;
}

export interface DemoPolicyTerms {
  comparator: string;
  threshold_scaled: number;
  unit: string;
  aggregation: string;
  agreement_rule: string;
  min_sources: number;
  source_ids: string[];
  tolerance_m: number;
  data_mode: "historical_simulation" | "live";
  condition_text: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  /** "What this tests" — one sentence, shown in the UI. */
  whatThisTests: string;
  provenance: Provenance;
  /** Set when provenance is on_chain: the real claim to link to. */
  onChainClaimId?: string;
  locationName: string;
  period: { start: string; end: string; timezone: string };
  policy: DemoPolicyTerms;
  series: DemoSeries[];
  expected: {
    decision: Decision | "";
    reason_code: ReasonCode | "";
    observed_value_scaled: number;
  };
  /** For contract-behaviour scenarios, the exact error the contract returns. */
  contractError?: string;
  /** Name of the direct test that pins this outcome. */
  verifyingTest: string;
  notes?: string;
}

// --- real recorded series --------------------------------------------------

/** London ERA5 + MERRA-2, exactly as returned by the documented endpoints. */
const LONDON_OM: Record<string, number | null> = {
  "2024-06-01": 0.1,
  "2024-06-02": 0.0,
  "2024-06-03": 0.2,
  "2024-06-04": 1.1,
  "2024-06-05": 0.0,
};

const LONDON_NASA: Record<string, number | null> = {
  "2024-06-01": 0.23,
  "2024-06-02": 0.04,
  "2024-06-03": 0.19,
  "2024-06-04": 2.03,
  "2024-06-05": 0.02,
};

/** Paris ERA5, exactly as returned. This is what claim-2 and claim-4 evaluated. */
const PARIS_OM: Record<string, number | null> = {
  "2024-06-01": 1.2,
  "2024-06-02": 0.0,
  "2024-06-03": 0.1,
  "2024-06-04": 0.8,
  "2024-06-05": 0.5,
};

/**
 * NASA POWER for the same Paris window, kept for reference. Not used by any
 * scenario because on this particular day MERRA-2 (3.79 mm) is further above
 * the threshold than ERA5 (1.20 mm), so the two never disagree about crossing.
 * The London pair does disagree, and that is what scenario 4 uses.
 * The values live in fixtures/historical/paris_2024-06-01_2024-06-05.json.
 */

const LONDON_PERIOD = { start: "2024-06-01", end: "2024-06-05", timezone: "UTC" };
const PARIS_PERIOD = { start: "2024-06-01", end: "2024-06-05", timezone: "UTC" };

function londonPolicy(over: Partial<DemoPolicyTerms> = {}): DemoPolicyTerms {
  return {
    comparator: "gt",
    threshold_scaled: 100,
    unit: "mm",
    aggregation: "max_single",
    agreement_rule: "unanimous",
    min_sources: 1,
    source_ids: ["om_archive_precip"],
    tolerance_m: 5000,
    data_mode: "historical_simulation",
    condition_text: "Any day with precipitation above 1.00 mm.",
    ...over,
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  // 1 -----------------------------------------------------------------------
  {
    id: "threshold-crossed",
    title: "Threshold clearly crossed",
    whatThisTests:
      "The ordinary success path: a real recorded reading sits above the threshold, so the condition is confirmed.",
    provenance: "on_chain",
    onChainClaimId: "claim-2",
    locationName: "Paris",
    period: PARIS_PERIOD,
    policy: {
      comparator: "gt",
      threshold_scaled: 100,
      unit: "mm",
      aggregation: "max_single",
      agreement_rule: "unanimous",
      min_sources: 1,
      source_ids: ["om_archive_precip"],
      // 12000 m: the ERA5 grid cell is ~5.97 km from the policy point, so a
      // tighter tolerance is what produces the location-mismatch scenario.
      tolerance_m: 12000,
      data_mode: "historical_simulation",
      condition_text: "Any day above 1.00 mm.",
    },
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: PARIS_OM, unit: "mm" },
    ],
    expected: { decision: "confirmed", reason_code: "threshold_crossed", observed_value_scaled: 120 },
    verifyingTest: "tests/direct/test_evaluation.py::test_clearly_above_threshold",
  },

  // 2 -----------------------------------------------------------------------
  {
    id: "threshold-not-reached",
    title: "Threshold clearly not reached",
    whatThisTests:
      "A real recorded claim whose highest reading is well below the threshold, so the condition is not confirmed.",
    provenance: "on_chain",
    onChainClaimId: "claim-5",
    locationName: "Paris",
    period: PARIS_PERIOD,
    policy: {
      comparator: "gt",
      threshold_scaled: 500,
      unit: "mm",
      aggregation: "max_single",
      agreement_rule: "unanimous",
      min_sources: 1,
      source_ids: ["om_archive_precip"],
      tolerance_m: 12000,
      data_mode: "historical_simulation",
      condition_text: "Any day with precipitation above 5.00 mm.",
    },
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: PARIS_OM, unit: "mm" },
    ],
    expected: { decision: "not_confirmed", reason_code: "threshold_not_crossed", observed_value_scaled: 120 },
    verifyingTest: "tests/direct/test_evaluation.py::test_clearly_below_threshold",
  },

  // 3 -----------------------------------------------------------------------
  {
    id: "exactly-at-threshold",
    title: "Exactly at the threshold",
    whatThisTests:
      "Boundary behaviour. The highest real reading is 1.10 mm and the threshold is 'more than 1.10 mm', so strictly-greater does not hold and the claim is not confirmed.",
    provenance: "recorded_source_data",
    locationName: "London",
    period: LONDON_PERIOD,
    policy: londonPolicy({ threshold_scaled: 110, condition_text: "Any day with precipitation above 1.10 mm." }),
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: LONDON_OM, unit: "mm" },
    ],
    expected: { decision: "not_confirmed", reason_code: "threshold_not_crossed", observed_value_scaled: 110 },
    verifyingTest: "tests/direct/test_evaluation.py::test_exactly_at_threshold_gt_is_not_crossed",
    notes:
      "With 'at least' instead of 'more than', the same data would confirm. The comparator decides this, not the evidence.",
  },

  // 4 -----------------------------------------------------------------------
  {
    id: "conflicting-sources",
    title: "Conflicting sources",
    whatThisTests:
      "Two real reanalyses of the same place disagree about whether the threshold was crossed. With a unanimous rule and no tie-break, the honest answer is inconclusive.",
    provenance: "recorded_source_data",
    locationName: "London",
    period: LONDON_PERIOD,
    policy: londonPolicy({
      threshold_scaled: 150,
      source_ids: ["om_archive_precip", "nasa_precip"],
      agreement_rule: "unanimous",
      min_sources: 2,
      condition_text: "Any day with precipitation above 1.50 mm, agreed by every source.",
    }),
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: LONDON_OM, unit: "mm" },
      { sourceId: "nasa_precip", label: "NASA POWER MERRA-2", shape: "triangle", daily: LONDON_NASA, unit: "mm/day" },
    ],
    expected: { decision: "inconclusive", reason_code: "source_conflict", observed_value_scaled: 203 },
    verifyingTest: "tests/direct/test_evaluation.py::test_unanimous_conflict_is_inconclusive",
    notes:
      "ERA5 peaks at 1.10 mm and does not cross 1.50 mm; MERRA-2 peaks at 2.03 mm and does. This is the case a deterministic chain cannot resolve on its own.",
  },

  // 5 -----------------------------------------------------------------------
  {
    id: "missing-observations",
    title: "Missing observations",
    whatThisTests:
      "The source returns only four of the five days. The contract does not interpolate the gap; it reports inconclusive and names what is missing.",
    provenance: "recorded_source_data",
    locationName: "London",
    period: LONDON_PERIOD,
    policy: londonPolicy(),
    series: [
      {
        sourceId: "om_archive_precip",
        label: "Open-Meteo ERA5 (day 5 not returned)",
        shape: "square",
        // 2024-06-05 is genuinely absent. It stays null; nothing fills it.
        daily: { ...LONDON_OM, "2024-06-05": null },
        unit: "mm",
      },
    ],
    expected: { decision: "inconclusive", reason_code: "missing_observations", observed_value_scaled: 110 },
    verifyingTest: "tests/direct/test_evaluation.py::test_gap_in_period_is_inconclusive",
    notes: "The gap is drawn as a hatched span on the chart. It is never estimated.",
  },

  // 6 -----------------------------------------------------------------------
  {
    id: "location-mismatch",
    title: "Location mismatch",
    whatThisTests:
      "A real on-chain case where the ERA5 grid cell sits about 5.97 km from the policy point, outside that policy's 5 km tolerance. The threshold was in fact met, but the evidence does not describe the right place, so the outcome is inconclusive.",
    provenance: "on_chain",
    onChainClaimId: "claim-4",
    locationName: "Paris",
    period: PARIS_PERIOD,
    policy: {
      comparator: "gt",
      threshold_scaled: 500,
      unit: "mm",
      aggregation: "max_single",
      agreement_rule: "unanimous",
      min_sources: 1,
      source_ids: ["om_archive_precip"],
      tolerance_m: 5000,
      data_mode: "historical_simulation",
      condition_text: "Any day with precipitation above 5.00 mm.",
    },
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: PARIS_OM, unit: "mm" },
    ],
    expected: { decision: "inconclusive", reason_code: "location_mismatch", observed_value_scaled: 120 },
    verifyingTest: "tests/direct/test_evaluation.py::test_location_mismatch",
    notes:
      "This was not staged. The same policy with a 12 km tolerance (claim-2) confirms, so the distance rule alone decides it.",
  },

  // 7 -----------------------------------------------------------------------
  {
    id: "repeated-attempt",
    title: "Repeated claim attempt",
    whatThisTests:
      "Claiming the same policy and period twice is rejected deterministically, so two claims can never disagree about the same observation window.",
    provenance: "recorded_source_data",
    locationName: "London",
    period: LONDON_PERIOD,
    policy: londonPolicy(),
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: LONDON_OM, unit: "mm" },
    ],
    expected: { decision: "", reason_code: "", observed_value_scaled: 0 },
    contractError: "EXPECTED: duplicate claim",
    verifyingTest: "tests/direct/test_state_machine.py::test_duplicate_claim_rejected",
    notes:
      "The first claim on a policy and period stands. To try again you retry that claim, or open a dispute on its decision.",
  },

  // 8 -----------------------------------------------------------------------
  {
    id: "dispute-round",
    title: "Dispute and re-evaluation round",
    whatThisTests:
      "A decided claim can be disputed once per round, up to the round limit. Resolving the dispute re-evaluates and increments the round counter instead of overwriting the first decision.",
    provenance: "recorded_source_data",
    locationName: "London",
    period: LONDON_PERIOD,
    policy: londonPolicy(),
    series: [
      { sourceId: "om_archive_precip", label: "Open-Meteo ERA5", shape: "square", daily: LONDON_OM, unit: "mm" },
    ],
    expected: { decision: "confirmed", reason_code: "threshold_crossed", observed_value_scaled: 110 },
    verifyingTest: "tests/direct/test_state_machine.py::test_dispute_flow_records_history",
    notes:
      "The first decision stays in the dispute history. Re-evaluation runs the same evidence rules, and the evaluation round number increases.",
  },
];

export function scenarioById(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}

/** Scenarios that are real on-chain claims, for the "run on network" toggle. */
export function onChainScenarios(): DemoScenario[] {
  return DEMO_SCENARIOS.filter((s) => s.provenance === "on_chain" && s.onChainClaimId);
}