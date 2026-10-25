import { ENV_CONTRACT_ADDRESS, ENV_EVALUATOR_ADDRESS, ENV_POLICY_ADDRESS } from "./env";

/**
 * The deployed contracts: the single source of truth for addresses, methods and
 * capabilities. Nothing else in the app may hard-code an address or a method
 * name; everything imports from here.
 *
 * WHY THREE CONTRACTS
 *   A deploy may not exceed roughly 19 KB of source, comments included. That was
 *   measured, not assumed: 19,410 B deployed, 20,294 B rejected, and a probe that
 *   was 90% comments was rejected too. See contracts/README.md. The evaluator
 *   (web fetch + consensus) and the claim (state + settlement) cannot share one
 *   contract under that budget, so they are separate and wired together.
 *
 * CURRENT DEPLOYMENT — GenLayer Bradbury, chain 4221
 *   ClimatePolicy     0xbad7E387Dbb7DE7470447041BC02147FFb0d899A
 *   ClimateEvaluator  0x1c7E7EdE3AE6cc1Fc456469fE366cb95D2dcd8C9
 *   ClimateClaim      0xD66064816966119D82B10A2c0735DB85219d6448
 *   All ACCEPTED / AGREE / FINISHED_WITH_RETURN.
 *
 * HOW A DECISION IS PRODUCED (the reason this project needs GenLayer)
 *   1. `evaluate_for_claim(claim_address, claim_id)` on ClimateEvaluator reads the
 *      claim's frozen policy from ClimateClaim with a deterministic cross-contract
 *      view, fetches every eligible source inside `gl.vm.run_nondet`, and compares
 *      leader and validator results under the documented equivalence rule. The
 *      structured result is stored on chain under (claim, dispute round).
 *   2. `sync_evaluation(claim_id)` on ClimateClaim reads that stored result and
 *      accepts it only if it names this policy version and period. A decisive
 *      outcome must also agree with ClimatePolicy.compute_evaluation over the same
 *      evidence rows, so it is both fetched and arithmetically consistent.
 *   3. Settlement consumes the recorded decision. No method anywhere accepts a
 *      decision, reason or evidence supplied by a caller or by the owner.
 *
 * ADDRESS ARGUMENTS: genlayer-js encodes a plain JS string as a string, so an
 * `Address` parameter has to be wrapped in the SDK's CalldataAddress type. See
 * `services/evaluationService.ts` — it does that for `evaluate_for_claim`.
 */

/** Which contract a method lives on. */
export type ContractKey = "policy" | "claim" | "evaluator";

/**
 * Address of the CLAIM contract.
 *
 * `VITE_CLIMATECLAIM_ADDRESS` in the repository-root `.env` overrides this when
 * set to a valid 0x-prefixed address (see `env.ts`); otherwise this literal is
 * used.
 */
export const CONTRACT_ADDRESS =
  ENV_CONTRACT_ADDRESS || "0xD66064816966119D82B10A2c0735DB85219d6448";

/** Address of the POLICY contract. `VITE_CLIMATEPOLICY_ADDRESS` overrides it. */
export const POLICY_ADDRESS =
  ENV_POLICY_ADDRESS || "0xbad7E387Dbb7DE7470447041BC02147FFb0d899A";

/**
 * Address of the EVALUATOR contract. `VITE_CLIMATEEVALUATOR_ADDRESS` overrides it.
 * This is the contract that fetches sources and reaches consensus; the claim
 * contract records only what this one stored.
 */
export const EVALUATOR_ADDRESS =
  ENV_EVALUATOR_ADDRESS || "0x1c7E7EdE3AE6cc1Fc456469fE366cb95D2dcd8C9"

/** All three addresses, keyed by which contract they are. */
export const CONTRACTS: Record<ContractKey, `0x${string}`> = {
  policy: POLICY_ADDRESS as `0x${string}`,
  claim: CONTRACT_ADDRESS as `0x${string}`,
  evaluator: EVALUATOR_ADDRESS as `0x${string}`,
};

/**
 * Owner of the deployments — the account that may call the owner-only writes:
 * `register_source`, `create_policy`, `set_beneficiary`, `retire_policy`,
 * `set_policy_status`, `confirm_settlement` and `fail_settlement`. Evaluating a
 * claim, finalizing it and emitting its payout are permissionless.
 */
export const DEPLOYER_ADDRESS = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";

/** Decimals used for every scaled integer the contracts store. */
export const SCALE_DECIMALS = 2;

/** Explorer base URL for the active network, used to build tx and address links. */
export const EXPLORER_TX_URL = "https://explorer-studio.genlayer.com/tx/";
export const EXPLORER_ADDRESS_URL = "https://explorer-studio.genlayer.com/address/";

/**
 * Every method the three deployed contracts expose, with its contract and
 * mutability. Taken from the schemas read back from chain after deployment and
 * saved at docs/schema/*.bradbury.txt.
 *
 * readonly: true -> view (instant). readonly: false -> write (consensus).
 */
export const METHOD_META = {
  // --- ClimatePolicy: sources, policies, and the deterministic engine --------
  register_source: { contract: "policy", readonly: false },
  create_policy: { contract: "policy", readonly: false },
  set_beneficiary: { contract: "policy", readonly: false },
  retire_policy: { contract: "policy", readonly: false },
  set_policy_status: { contract: "policy", readonly: false },
  get_policy: { contract: "policy", readonly: true },
  list_policies: { contract: "policy", readonly: true },
  list_sources: { contract: "policy", readonly: true },
  // Pure function of (frozen policy, evidence rows). The claim cross-checks a
  // decisive consensus result against it in `sync_evaluation`.
  compute_evaluation: { contract: "policy", readonly: true },

  // --- ClimateEvaluator: the non-deterministic half ---------------------------
  // Fetches every eligible source inside a leader/validator round and stores the
  // structured result on chain. Permissionless.
  evaluate_for_claim: { contract: "evaluator", readonly: false },
  get_result: { contract: "evaluator", readonly: true },

  // --- ClimateClaim: claims, disputes, settlement ----------------------------
  start_claim: { contract: "claim", readonly: false },
  // Permissionless: records a stored consensus result against the claim.
  sync_evaluation: { contract: "claim", readonly: false },
  open_dispute: { contract: "claim", readonly: false },
  // Permissionless: finality of a decided claim and a confirmed payout.
  finalize_decision: { contract: "claim", readonly: false },
  fund: { contract: "claim", readonly: false },
  settle_claim: { contract: "claim", readonly: false },
  // Owner-only administrative closure of an emitted payout.
  confirm_settlement: { contract: "claim", readonly: false },
  fail_settlement: { contract: "claim", readonly: false },
  get_claim: { contract: "claim", readonly: true },
  list_claims: { contract: "claim", readonly: true },
  get_claim_count: { contract: "claim", readonly: true },
  get_escrow_balance: { contract: "claim", readonly: true },
  get_refunds: { contract: "claim", readonly: true },
  get_in_flight: { contract: "claim", readonly: true },
  get_evaluator: { contract: "claim", readonly: true },
} as const satisfies Record<string, { contract: ContractKey; readonly: boolean }>;

/** Method name type. Every one of these exists in a deployed schema. */
export type MethodName = keyof typeof METHOD_META;

/**
 * Method names as string constants. Deliberately mirrors METHOD_META rather than
 * restating names, so a method renamed in one place is renamed in both.
 */
export const METHODS = Object.fromEntries(
  (Object.keys(METHOD_META) as MethodName[]).map((name) => [name, name]),
) as { readonly [K in MethodName]: K };

/** Which contract a method lives on. Throws on an unknown name. */
export function contractFor(method: string): ContractKey {
  const meta = (METHOD_META as Record<string, { contract: ContractKey } | undefined>)[method];
  if (!meta) {
    throw new Error(
      `"${method}" is not in the deployed schema. It is on none of ClimatePolicy, ` +
        `ClimateEvaluator or ClimateClaim, so calling it would fail at the RPC.`,
    );
  }
  return meta.contract;
}

/** Address of the contract a method lives on. */
export function addressFor(method: string): `0x${string}` {
  return CONTRACTS[contractFor(method)];
}

/**
 * Capabilities the UI once had and where they live now.
 *
 * `removed` means no deployed method provides it. `derived` means the service
 * layer reconstructs it from reads. `engine` means it comes from the pure
 * `compute_evaluation`. `evaluator` means the consensus evaluator produces or
 * stores it.
 */
export const AVAILABILITY = {
  // Per-check results are stored with the evaluator's result.
  get_checks: "evaluator",
  get_criteria_version: "evaluator",
  get_owner: "derived",
  // The consensus round that fetches sources and decides.
  request_evaluation: "evaluator",
  evaluate_from_web: "evaluator",
  get_source: "derived",
  get_policy_count: "derived",
  get_source_count: "derived",
  find_claim: "derived",
  get_evidence: "derived",
  get_disputes: "derived",
  get_settlement: "derived",
  get_payouts: "derived",
} as const satisfies Record<string, "removed" | "derived" | "engine" | "evaluator">;
