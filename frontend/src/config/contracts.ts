/**
 * Deployed contract addresses and schema-derived method names.
 *
 * ADDRESS VERIFICATION: `0x6E4BD06bD969E745546A7957d818eDaD47882ea8` is the v2
 * StudioNet deployment (deploy tx 0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f,
 * consensus 5/5 AGREE, ACCEPTED), confirmed live by calling view methods
 * (list_policies -> 7, list_claims -> 6, list_sources -> 5). The v1 deployment
 * (0xE160...0c) and its artifacts are preserved under artifacts/deployment-v1/.
 *
 * METHOD NAMES: taken from `genlayer schema 0x6E4B...ea8`, saved verbatim at
 * docs/schema.genlayer-cli.txt. Not from memory.
 */

import { ACTIVE_NETWORK } from "./network";

export const CONTRACT_ADDRESS = "0x6E4BD06bD969E745546A7957d818eDaD47882ea8";

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
} as const;

export type MethodName = (typeof METHODS)[keyof typeof METHODS];

export const CONTRACT_META = {
  address: CONTRACT_ADDRESS,
  network: ACTIVE_NETWORK,
  criteriaVersion: "climateclaim-criteria-1",
} as const;