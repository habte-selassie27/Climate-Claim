import { ENV_CONTRACT_ADDRESS, ENV_POLICY_ADDRESS } from "./env";

/**
 * Deployed contract addresses and schema-derived method names.
 *
 * THE PROJECT DEPLOYS AS TWO CONTRACTS. This is not a style choice. Bradbury
 * enforces a size-dependent gas ceiling on deploys (`gas limit too high`), and a
 * single 1406-line contract could not be deployed anywhere public:
 *
 *   793 lines  -> REJECTED by Bradbury
 *   427 lines  -> deployed
 *   260 lines  -> deployed
 *
 * So the source was split into a policy contract and a claim contract, and the
 * split is what made a public deployment possible at all.
 *
 * CURRENT DEPLOYMENT: both on GenLayer Bradbury (chain 4221), deploy tx hashes
 * and full verification in docs/deployment-bradbury-2026-10-18.md. Both reached
 * consensus 5/5 AGREE with FINISHED_WITH_RETURN, and both were confirmed on
 * Bradbury rather than StudioNet by reading `eth_getCode` from
 * rpc-bradbury.genlayer.com and by StudioNet answering "Contract ... not found".
 *
 * THE TWO CONTRACTS DO NOT CALL EACH OTHER. Storing a contract proxy in
 * GenLayer state currently fails with "not marked for usage within storage,
 * please annotate it with @allow_storage", so rather than depend on an
 * unverified cross-contract ABI the split uses an owner-mediated bridge. See
 * `register_policy_snapshot` below.
 *
 * WHAT THIS DEPLOYMENT DOES NOT DO, stated plainly because the UI must not
 * imply otherwise:
 *
 *   - There is NO on-chain evaluation. `record_evaluation` is owner-only and
 *     receives the decision as an argument; the contract does not fetch weather
 *     data, does not call a model, and does not compute a threshold comparison.
 *     The earlier single-contract design did all three.
 *   - There are NO per-check results on chain. The old `get_checks` returned
 *     threshold/period/location/agreement/completeness rows. Nothing in either
 *     contract produces them, so any screen that showed them has no data source.
 *   - There is NO `get_criteria_version`, `get_owner`, `get_source`,
 *     `get_policy_count` or `find_claim`. The first two simply do not exist;
 *     the other three are derived in the service layer from list reads.
 *
 * `AVAILABILITY` below records this per method so a caller cannot quietly
 * assume a capability that is not there.
 */

/** Which of the two contracts a method lives on. */
export type ContractKey = "policy" | "claim";

/**
 * Address of the CLAIM contract.
 *
 * `VITE_CLIMATECLAIM_ADDRESS` in the repository-root `.env` overrides this when
 * set to a valid 0x-prefixed address (see `env.ts`); otherwise this literal is
 * used. The override exists so a redeployment can be pointed at without a code
 * change.
 */
export const CONTRACT_ADDRESS =
  ENV_CONTRACT_ADDRESS || "0xa2D82Db4ddC567199113962BFd477f069510331D";

/**
 * Address of the POLICY contract.
 *
 * `VITE_CLIMATEPOLICY_ADDRESS` overrides it, same rules as above.
 */
export const POLICY_ADDRESS =
  ENV_POLICY_ADDRESS || "0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631";

/** Both addresses, keyed by which contract they are. */
export const CONTRACTS: Record<ContractKey, `0x${string}`> = {
  policy: POLICY_ADDRESS as `0x${string}`,
  claim: CONTRACT_ADDRESS as `0x${string}`,
};

/**
 * Owner of both deployments — the account that may call the owner-only writes.
 *
 * This is the `bradbury` keystore account, which deployed both contracts and is
 * the only account that can call `create_policy`, `register_source`,
 * `record_evaluation`, `register_policy_snapshot` and the settlement writes.
 * It is NOT the StudioNet owner account; the two deployments have different
 * owners and this constant tracks the active (Bradbury) deployment.
 */
export const DEPLOYER_ADDRESS = "0x04e0353B7218b66D6803725ce7342E6e1225DB1b";

/** Decimals used for every scaled integer the contracts store. */
export const SCALE_DECIMALS = 2;

/**
 * Every method the two deployed contracts expose, with its contract and
 * mutability. Taken from the schemas captured with `genlayer schema` and saved
 * at docs/schema/climate-policy.bradbury.txt and
 * docs/schema/climate-claim.bradbury.txt.
 *
 * readonly: true -> view (instant). readonly: false -> write (consensus).
 */
export const METHOD_META = {
  // --- ClimatePolicy: sources and policies ---------------------------------
  register_source: { contract: "policy", readonly: false },
  create_policy: { contract: "policy", readonly: false },
  set_beneficiary: { contract: "policy", readonly: false },
  retire_policy: { contract: "policy", readonly: false },
  get_policy: { contract: "policy", readonly: true },
  list_policies: { contract: "policy", readonly: true },
  list_sources: { contract: "policy", readonly: true },

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
 * Method names as string constants.
 *
 * Deliberately mirrors METHOD_META rather than restating names, so the two
 * cannot drift: a method renamed in one place is renamed in both.
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
 * Capabilities the UI used to have and this deployment does not. Each is keyed
 * by the old method name so a reader can trace where it went.
 *
 * `removed` means no deployed method provides it and nothing can be derived.
 * `derived` means the service layer reconstructs it from list reads.
 */
export const AVAILABILITY = {
  get_checks: "removed",
  get_criteria_version: "removed",
  get_owner: "removed",
  request_evaluation: "removed",
  get_source: "derived",
  get_policy_count: "derived",
  find_claim: "derived",
  get_source_count: "derived",
  get_evidence: "derived",
  get_disputes: "derived",
  get_settlement: "derived",
  get_payouts: "derived",
} as const satisfies Record<string, "removed" | "derived">;
