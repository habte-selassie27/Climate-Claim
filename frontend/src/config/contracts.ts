import { ENV_CONTRACT_ADDRESS, ENV_POLICY_ADDRESS } from "./env";

/**
 * The deployed contracts: the single source of truth for addresses, methods and
 * capabilities. Nothing else in the app may hard-code an address or a method
 * name; everything imports from here.
 *
 * WHY THE PROJECT DEPLOYS AS TWO CONTRACTS
 *   This is a deployment requirement, not a style choice. Both GenLayer testnets
 *   reject a deploy whose source exceeds roughly 19 KB, comments included. That
 *   was measured, not assumed: 18,600 B deployed, 20,294 B rejected, and a probe
 *   that was 90% comments was rejected too, so the limit counts source bytes
 *   rather than logic. See contracts/README.md.
 *
 * CURRENT DEPLOYMENT — GenLayer Bradbury, chain 4221
 *   ClimatePolicy  0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807  (16,829 B, 8 methods)
 *     deploy tx 0x8f704bc3bab2578a5c66981ba922dfb349a65f6817acac475af68d046889f658
 *   ClimateClaim   0x07C1c5740eD73576deF939bb938556761738dA03  (18,600 B, 16 methods)
 *     deploy tx 0xa7deeaceb6ef12ca8b2a226c45b5502b062b344942859930300d52d5c2c7c631
 *   Both ACCEPTED / AGREE / FINISHED_WITH_RETURN. Schemas read back from chain and
 *   saved at docs/schema/*.bradbury.txt.
 *
 * THE TWO CONTRACTS DO NOT CALL EACH OTHER. GenLayer storage cannot hold a
 * contract proxy, so the split uses an owner-mediated bridge: the owner copies a
 * policy across with `register_policy_snapshot`, and the claim then references it
 * by id. `register_policy_snapshot` is OWNER-ONLY, so creating a claim against a
 * policy the owner has not bridged yet will revert — see ClaimNew.tsx, which
 * reports that rather than pretending otherwise.
 *
 * WHAT THIS DEPLOYMENT DOES NOT DO, stated plainly because the UI must not imply
 * otherwise:
 *   - There is NO web access on chain. Nothing fetches weather data. Evidence
 *     rows are supplied by the caller, so their provenance is not provable on
 *     chain and the UI must not imply it is.
 *   - There is NO model call on chain. `compute_evaluation` is a pure function of
 *     (frozen policy, evidence rows): it recomputes each row's `crossed` flag
 *     from the raw value and the threshold, and derives the decision. It is
 *     therefore not a consensus judgement over nondeterministic interpretation —
 *     it is on-chain arithmetic the caller cannot contradict.
 *   - `get_checks` is not a method. Per-check results come from
 *     `compute_evaluation`, not from stored state.
 */

/** Which of the two contracts a method lives on. */
export type ContractKey = "policy" | "claim";

/**
 * Address of the CLAIM contract.
 *
 * `VITE_CLIMATECLAIM_ADDRESS` in the repository-root `.env` overrides this when
 * set to a valid 0x-prefixed address (see `env.ts`); otherwise this literal is
 * used.
 */
export const CONTRACT_ADDRESS =
  ENV_CONTRACT_ADDRESS || "0x07C1c5740eD73576deF939bb938556761738dA03";

/** Address of the POLICY contract. `VITE_CLIMATEPOLICY_ADDRESS` overrides it. */
export const POLICY_ADDRESS =
  ENV_POLICY_ADDRESS || "0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807";

/** Both addresses, keyed by which contract they are. */
export const CONTRACTS: Record<ContractKey, `0x${string}`> = {
  policy: POLICY_ADDRESS as `0x${string}`,
  claim: CONTRACT_ADDRESS as `0x${string}`,
};

/**
 * Owner of both deployments — the only account that may call the owner-only
 * writes (`register_source`, `create_policy`, `retire_policy`,
 * `set_beneficiary`, `register_policy_snapshot`, `record_evaluation`,
 * `resolve_dispute` and the settlement writes).
 *
 * This is the `bradbury` keystore account that performed both deploys. It is NOT
 * the older StudioNet owner; the two deployments have different owners and this
 * constant tracks the active one.
 */
export const DEPLOYER_ADDRESS = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";

/** Decimals used for every scaled integer the contracts store. */
export const SCALE_DECIMALS = 2;

/** Explorer base URL for the active network, used to build tx and address links. */
export const EXPLORER_TX_URL = "https://explorer-bradbury.genlayer.com/tx/";
export const EXPLORER_ADDRESS_URL = "https://explorer-bradbury.genlayer.com/address/";

/**
 * Every method the two deployed contracts expose, with its contract and
 * mutability. Taken from the schemas read back from chain after deployment and
 * saved at docs/schema/climate-policy.bradbury.txt and
 * docs/schema/climate-claim.bradbury.txt.
 *
 * readonly: true -> view (instant). readonly: false -> write (consensus).
 */
export const METHOD_META = {
  // --- ClimatePolicy: sources, policies, and the decision engine -------------
  register_source: { contract: "policy", readonly: false },
  create_policy: { contract: "policy", readonly: false },
  set_beneficiary: { contract: "policy", readonly: false },
  retire_policy: { contract: "policy", readonly: false },
  get_policy: { contract: "policy", readonly: true },
  list_policies: { contract: "policy", readonly: true },
  list_sources: { contract: "policy", readonly: true },
  // NEW in this deployment: derives a decision from a frozen policy + evidence.
  compute_evaluation: { contract: "policy", readonly: true },

  // --- ClimateClaim: claims, disputes, settlement --------------------------
  register_policy_snapshot: { contract: "claim", readonly: false },
  start_claim: { contract: "claim", readonly: false },
  record_evaluation: { contract: "claim", readonly: false },
  open_dispute: { contract: "claim", readonly: false },
  resolve_dispute: { contract: "claim", readonly: false },
  finalize_decision: { contract: "claim", readonly: false },
  fund: { contract: "claim", readonly: false },
  settle_claim: { contract: "claim", readonly: false },
  confirm_settlement: { contract: "claim", readonly: false },
  fail_settlement: { contract: "claim", readonly: false },
  get_claim: { contract: "claim", readonly: true },
  list_claims: { contract: "claim", readonly: true },
  get_claim_count: { contract: "claim", readonly: true },
  get_escrow_balance: { contract: "claim", readonly: true },
  get_refunds: { contract: "claim", readonly: true },
  get_in_flight: { contract: "claim", readonly: true },
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
      `"${method}" is not in the deployed schema. It is neither on ClimatePolicy ` +
        `nor on ClimateClaim, so calling it would fail at the RPC.`,
    );
  }
  return meta.contract;
}

/** Address of the contract a method lives on. */
export function addressFor(method: string): `0x${string}` {
  return CONTRACTS[contractFor(method)];
}

/**
 * Capabilities the UI once had and this deployment does not expose as methods.
 *
 * `removed` means no deployed method provides it and nothing can be derived from
 * a read. `derived` means the service layer reconstructs it from list reads.
 * `engine` means the capability exists but is produced by `compute_evaluation`
 * rather than stored on a claim.
 */
export const AVAILABILITY = {
  // Per-check results are produced by the engine, not stored.
  get_checks: "engine",
  // No on-chain model call, so there is no criteria version to read back.
  get_criteria_version: "removed",
  get_owner: "derived",
  request_evaluation: "removed",
  // Nothing fetches weather data on chain.
  evaluate_from_web: "removed",
  get_source: "derived",
  get_policy_count: "derived",
  get_source_count: "derived",
  find_claim: "derived",
  get_evidence: "derived",
  get_disputes: "derived",
  get_settlement: "derived",
  get_payouts: "derived",
} as const satisfies Record<string, "removed" | "derived" | "engine">;