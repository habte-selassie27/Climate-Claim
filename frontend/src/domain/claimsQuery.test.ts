import { describe, expect, it } from "vitest";
import {
  CLAIMS_PAGE_SIZE,
  claimStates,
  filterClaims,
  paginate,
  EMPTY_CLAIMS_FILTER,
} from "./claimsQuery";
import type { Claim } from "./types";

function claim(over: Partial<Claim>): Claim {
  return {
    id: "claim-1",
    policy_id: "policy-1",
    claimant: "0xabc",
    state: "created",
    decision: "",
    reason_code: "",
    observed_value_scaled: 0,
    summary: "",
    criteria_version: "climateclaim-criteria-1",
    eval_round: 0,
    finalized: false,
    settlement_state: "not_settled",
    eval_error: "",
    ...over,
  };
}

const ROWS: Claim[] = [
  claim({ id: "claim-1", state: "decided_confirmed", decision: "confirmed" }),
  claim({ id: "claim-2", state: "decided_not_confirmed", decision: "not_confirmed" }),
  claim({ id: "claim-3", state: "inconclusive", decision: "inconclusive" }),
  claim({ id: "claim-4", state: "created" }),
  claim({
    id: "claim-5",
    policy_id: "policy-london",
    claimant: "0xDEF",
    state: "created",
    eval_error: "EXTERNAL: sources unreachable",
  }),
];

describe("filterClaims", () => {
  it("returns everything for the empty filter", () => {
    expect(filterClaims(ROWS, EMPTY_CLAIMS_FILTER)).toHaveLength(5);
  });

  it("matches claim ids case-insensitively", () => {
    const out = filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, text: "CLAIM-3" });
    expect(out.map((c) => c.id)).toEqual(["claim-3"]);
  });

  it("matches policy ids", () => {
    const out = filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, text: "london" });
    expect(out.map((c) => c.id)).toEqual(["claim-5"]);
  });

  it("matches claimant addresses", () => {
    const out = filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, text: "0xdef" });
    expect(out.map((c) => c.id)).toEqual(["claim-5"]);
  });

  it("treats whitespace-only text as no filter", () => {
    expect(filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, text: "   " })).toHaveLength(5);
  });

  it("filters by each decision", () => {
    const pick = (decision: "confirmed" | "not_confirmed" | "inconclusive") =>
      filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, decision }).map((c) => c.id);
    expect(pick("confirmed")).toEqual(["claim-1"]);
    expect(pick("not_confirmed")).toEqual(["claim-2"]);
    expect(pick("inconclusive")).toEqual(["claim-3"]);
  });

  it("treats a claim with no decision, including a failed evaluation, as pending", () => {
    const out = filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, decision: "pending" });
    expect(out.map((c) => c.id)).toEqual(["claim-4", "claim-5"]);
  });

  it("filters by exact state", () => {
    const out = filterClaims(ROWS, { ...EMPTY_CLAIMS_FILTER, state: "created" });
    expect(out.map((c) => c.id)).toEqual(["claim-4", "claim-5"]);
  });

  it("combines text, decision and state", () => {
    const out = filterClaims(ROWS, { text: "claim", decision: "pending", state: "created" });
    expect(out.map((c) => c.id)).toEqual(["claim-4", "claim-5"]);
    const narrow = filterClaims(ROWS, { text: "london", decision: "pending", state: "created" });
    expect(narrow.map((c) => c.id)).toEqual(["claim-5"]);
  });

  it("returns nothing when the facets contradict", () => {
    const out = filterClaims(ROWS, { text: "", decision: "confirmed", state: "created" });
    expect(out).toEqual([]);
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 12 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const page = paginate(rows, 2, 5);
    expect(page.rows).toEqual([6, 7, 8, 9, 10]);
    expect(page.page).toBe(2);
    expect(page.pages).toBe(3);
    expect(page.total).toBe(12);
  });

  it("clamps a page past the end to the last page", () => {
    const page = paginate(rows, 99, 5);
    expect(page.page).toBe(3);
    expect(page.rows).toEqual([11, 12]);
  });

  it("clamps page zero and negative pages to the first page", () => {
    expect(paginate(rows, 0, 5).page).toBe(1);
    expect(paginate(rows, -3, 5).page).toBe(1);
  });

  it("handles an empty result set as one empty page", () => {
    const page = paginate([], 4, 5);
    expect(page.rows).toEqual([]);
    expect(page.page).toBe(1);
    expect(page.pages).toBe(1);
    expect(page.total).toBe(0);
  });

  it("fits inside one page when the page size exceeds the row count", () => {
    const page = paginate(rows, 1, 50);
    expect(page.pages).toBe(1);
    expect(page.rows).toHaveLength(12);
  });

  it("defaults to the claims page size", () => {
    expect(CLAIMS_PAGE_SIZE).toBe(8);
    expect(paginate(rows, 1).rows).toHaveLength(8);
  });
});

describe("claimStates", () => {
  it("lists only the states present, in state-machine order", () => {
    expect(claimStates(ROWS)).toEqual([
      "created",
      "decided_confirmed",
      "decided_not_confirmed",
      "inconclusive",
    ]);
  });

  it("keeps an unknown state visible, sorted after the known ones", () => {
    const withUnknown = [
      ...ROWS,
      { ...claim({ id: "claim-9" }), state: "paused" as Claim["state"] },
    ];
    expect(claimStates(withUnknown).at(-1)).toBe("paused");
  });

  it("returns nothing for no claims", () => {
    expect(claimStates([])).toEqual([]);
  });
});
