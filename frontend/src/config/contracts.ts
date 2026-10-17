import { ENV_CONTRACT_ADDRESS } from "./env";

/**
 * Deployed contract addresses and schema-derived method names.
 *
 * CURRENT ADDRESS: `0x6E4BD06bD969E745546A7957d818eDaD47882ea8` on StudioNet
 * (chain 61999). This is the v2 deployment -- deploy tx
 * 0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f, consensus
 * 5/5 AGREE, ACCEPTED -- and was confirmed live at the time by view methods
 * (list_policies -> 7, list_claims -> 6, list_sources -> 5).
 *
 * It is deployed to a PUBLIC explorer, so the address is independently checkable,
 * which is why it is preferred over a newer build with a lower method count.
 *
 * IT PREDATES THE AUDIT FIXES. The contract source in this repo is 32 methods
 * (19 view, 13 write). This deployment has 27. The six missing ones are the
 * audit work -- two-phase settlement, in-flight tracking, refunds and payouts:
 *
 *   confirm_settlement   fail_settlement   get_in_flight
 *   get_refunds          get_payouts       get_source_count
 *
 * They exist in contracts/climateclaim.py and are covered by the direct test
 * suite, but they are NOT deployed, and no public deployment of the current
 * source exists. Deploying it is blocked on infrastructure, not on the code:
 * StudioNet's shared rate limit (deploys cannot complete their call sequence
 * before the bucket refills) and, on Bradbury/Asimov, the missing gas override
 * in deployContract -- genlayerlabs/genlayer-cli#419.
 *
 * CONSEQUENCE FOR THE UI: every settlement control that calls one of those six
 * will fail against this deployment. The buttons are still rendered because the
 * audit trail matters more than a tidy screen, but a call that cannot succeed
 * must not look as though it can. Do not present settlement as working.
 *
 * CONSIDERED AND REJECTED: 0x6e085313b65962e0Dd6930AFB9B548Ab23a50C6F is also
 * ClimateClaim and also has 27 methods -- its deployed source was read directly
 * and confirms the same six are absent. Same class, no advantage, and no
 * recorded consensus. 0xA8cc5b18C4ED3b3F5122bE02c972C17f224b27d6 is NOT this
 * project (CommitmentRegistry / ReviewChallenge / OutcomeRecord).
 */

/**
 * Contract address.
 *
 * `VITE_CLIMATECLAIM_ADDRESS` in the repository-root `.env` overrides this when
 * set to a valid 0x-prefixed address (see `env.ts`); otherwise this literal is
 * used. The override exists so a redeployment can be pointed at without a code
 * change. METHOD NAMES below come from this deployment's schema, captured with
 * `genlayer schema` and saved at docs/schema.genlayer-cli.txt. That schema has 27
 * methods, not the 32 the source defines -- see the note above before trusting
 * any write path.
 */
export const CONTRACT_ADDRESS =
  ENV_CONTRACT_ADDRESS || "0x6E4BD06bD969E745546A7957d818eDaD47882ea8";
/** Owner / claimant address of the deployed contract (local `rabby` account). */
export const DEPLOYER_ADDRESS = "0x5B3661C576c7001e6d6279C67F3779705d334c89";

/** Decimals used for every scaled integer the contract stores. */
export const SCALE_DECIMALS = 2;

/**
 * Method names exactly as they appear in the saved schema.
 * readonly: true -> view (instant). readonly: false -> write (consensus).
 */
export const METHODS = {
  // views
  get_owner: "get_owner",
  get_criteria_version: "get_criteria_version",
  get_source: "get_source",
  list_sources: "list_sources",
  get_policy: "get_policy",
  list_policies: "list_policies",
  get_policy_count: "get_policy_count",
  get_claim_count: "get_claim_count",
  find_claim: "find_claim",
  get_claim: "get_claim",
  list_claims: "list_claims",
  get_evidence: "get_evidence",
  get_checks: "get_checks",
  get_disputes: "get_disputes",
  get_settlement: "get_settlement",
  get_source_count: "get_source_count",
  get_in_flight: "get_in_flight",
  get_refunds: "get_refunds",
  get_payouts: "get_payouts",
  // writes
  create_policy: "create_policy",
  register_source: "register_source",
  set_beneficiary: "set_beneficiary",
  retire_policy: "retire_policy",
  start_claim: "start_claim",
  request_evaluation: "request_evaluation",
  open_dispute: "open_dispute",
  resolve_dispute: "resolve_dispute",
  finalize_decision: "finalize_decision",
  fund: "fund",
  settle_claim: "settle_claim",
  confirm_settlement: "confirm_settlement",
  fail_settlement: "fail_settlement",
} as const;