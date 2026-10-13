/**
 * Deployed contract addresses and schema-derived method names.
 *
 * ADDRESS VERIFICATION: `0xE16032420e3155C0822e9150a98c6B1163869F0c` was read
 * from the StudioNet deployment and confirmed live by calling view methods on
 * it (get_claim_count -> 2, get_policy_count -> 3).
 *
 * METHOD NAMES: taken from `genlayer schema 0xE160...0c`, saved verbatim at
 * docs/schema.genlayer-cli.txt. Not from memory.
 */

import { ACTIVE_NETWORK } from "./network";

export const CONTRACT_ADDRESS = "0xE16032420e3155C0822e9150a98c6B1163869F0c";

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