import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  CONTRACT_ADDRESS,
  EVALUATOR_ADDRESS,
  POLICY_ADDRESS,
  addressFor,
  METHODS,
} from "../config/contracts";

/**
 * The two creation workflows and the dynamic demo.
 *
 * Both are driven by the DEPLOYED schemas, read back from chain after deploy and
 * saved at docs/schema/*.bradbury.txt:
 *
 *   ClimatePolicy.create_policy(...)                                    WRITE
 *   ClimateClaim.start_claim(policy_id, period_start, period_end)       WRITE
 *   ClimateEvaluator.evaluate_for_claim(claim, claim_id)                WRITE
 *   ClimateClaim.sync_evaluation(claim_id)                              WRITE
 *   ClimatePolicy.compute_evaluation(policy, evidence, days)            VIEW
 *
 * Nothing here may invent a capability: these assert the forms call methods
 * that exist and pass the arity the schema declares.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** Strip comments so prose about the old data is not mistaken for the old data. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("policy creation", () => {
  const page = () => read("pages/PolicyNew.tsx");

  it("routes create_policy to the policy contract", () => {
    expect(addressFor(METHODS.create_policy)).toBe(POLICY_ADDRESS);
  });

  it("the form calls create_policy", () => {
    expect(page()).toContain('runWrite("create_policy"');
  });

  it("passes create_policy its full declared arity", () => {
    // The deployed schema declares 18 parameters. A form sending fewer would
    // revert, so the argument array is counted against that number.
    const args = /const args = \[([\s\S]*?)\];/.exec(page())?.[1] ?? "";
    expect(args.split(",").map((a) => a.trim()).filter(Boolean).length).toBe(18);
  });

  it("is reachable from the policies page", () => {
    expect(read("pages/Policies.tsx")).toContain('to="/policies/new"');
    expect(read("App.tsx")).toContain('path="/policies/new"');
  });
});

describe("claim creation", () => {
  it("routes start_claim to the claim contract", () => {
    expect(addressFor(METHODS.start_claim)).toBe(CONTRACT_ADDRESS);
  });

  it("the form calls start_claim with (policy_id, start, end)", () => {
    const src = read("components/StartClaimPanel.tsx");
    expect(src).toContain('runWrite("start_claim", [policy.id, periodStart, periodEnd]');
  });

  it("connects the wallet from the primary action instead of a dead disabled button", () => {
    // Before this, a disconnected visitor clicked Start a claim and nothing
    // happened: the button was disabled, which reads as a broken page.
    const src = read("components/StartClaimPanel.tsx");
    expect(src).toContain("void wallet.connect()");
    expect(src).toContain('t("wallet.connect")');
  });

  it("is reachable from the claims page through a Create Claim action", () => {
    expect(read("pages/Claims.tsx")).toContain('to="/claims/new"');
    expect(read("App.tsx")).toContain('path="/claims/new"');
  });

  it("offers the action again when there are no claims", () => {
    // An empty deployment must still offer the way out of being empty.
    const src = read("pages/Claims.tsx");
    expect(src).toContain('data-testid="claims-empty"');
    expect(src.indexOf('claims-empty')).toBeLessThan(src.indexOf('to="/claims/new"', src.indexOf('claims-empty')));
  });

  it("lists live policies rather than assuming one", () => {
    const src = read("pages/ClaimNew.tsx");
    // Forced read on mount: the page is the form, and a cached list could
    // predate a policy the user just created.
    expect(src).toContain("listPolicies(true)");
    // No fabricated default policy: the choice comes from what was read.
    expect(src).not.toMatch(/useState\("[^"]*policy-\d/);
    expect(src).toContain("active[0].id");
  });

  it("states that evaluation fetches the sources itself", () => {
    // start_claim reads the policy cross-contract, so there is no bridge step;
    // the page must not claim one exists.
    const src = read("pages/ClaimNew.tsx");
    expect(src).toContain("claimNew.evaluate.h");
    expect(src).not.toMatch(/register_policy_snapshot/);
  });

  it("runs the consensus round before recording it on the claim", () => {
    const src = read("pages/ClaimDetail.tsx");
    expect(src).toContain('runWrite("evaluate_for_claim"');
    expect(src).toContain('runWrite("sync_evaluation"');
  });

  it("routes the consensus round to the evaluator", () => {
    expect(addressFor(METHODS.evaluate_for_claim)).toBe(EVALUATOR_ADDRESS);
  });
});

describe("the demo is dynamic", () => {
  const page = () => read("pages/Demo.tsx");

  it("reads claims from the chain", () => {
    expect(page()).toContain("listClaims()");
  });

  it("renders every claim it read, not a fixed one", () => {
    const src = code(page());
    expect(src).toContain("rows.map");
    expect(src).not.toMatch(/["'`]\s*claim-\d+\s*["'`]/);
  });

  it("has an empty state with a Create Claim action", () => {
    const src = page();
    expect(src).toContain('data-testid="demo-no-claims"');
    expect(src).toContain('to="/claims/new"');
  });

  it("handles loading, error and populated states", () => {
    const src = page();
    expect(src).toContain("claims.loading");
    expect(src).toContain('claims.origin === "error"');
    expect(src).toContain("rows.length === 0");
  });

  it("separates live claims from recorded replays", () => {
    const src = page();
    expect(src).toContain('data-testid="demo-live-claims"');
    expect(src).toContain('data-testid="demo-replays"');
    expect(src).toMatch(/Not transactions/i);
  });

  it("derives the replay outcome from the deployed engine", () => {
    // The replay must run the real contract method, not a stored answer.
    expect(page()).toContain("computeEvaluation");
    expect(addressFor(METHODS.compute_evaluation)).toBe(POLICY_ADDRESS);
  });
});

describe("counts come from real reads", () => {
  it("the claims count is derived from list_claims, not a constant", () => {
    const src = read("services/claimService.ts");
    const fn = src.slice(src.indexOf("export async function listClaims"));
    expect(fn.slice(0, 600)).toContain("METHODS.list_claims");
  });

  it("the policy count is derived from list_policies", () => {
    const src = read("services/claimService.ts");
    const fn = src.slice(src.indexOf("export async function getPolicyCount"));
    expect(fn).toContain("(list.data ?? []).length");
  });
});