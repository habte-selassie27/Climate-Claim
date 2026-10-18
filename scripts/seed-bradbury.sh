#!/usr/bin/env bash
# Seed the CURRENT Bradbury deployment so the app has something real to show.
#
# SAFE BY CONSTRUCTION:
#   - Refuses to run unless BOTH contract addresses are set and are 0x40-hex.
#   - Refuses if the deployment already has policies, so it cannot duplicate.
#   - Never deploys a contract and never edits .env or any config.
#   - Every step prints the tx hash; a failure stops the script.
#
# The order matters and is forced by the contracts:
#   1. register_source      (ClimatePolicy, owner-only)  -- policies need sources
#   2. create_policy        (ClimatePolicy, owner-only)
#   3. start_claim          (ClimateClaim, anyone)
#   4. record_evaluation    (ClimateClaim, owner-only) -- stores the DERIVED decision
#
# Step 3 needs NO bridge step. `start_claim` reads the authoritative policy from
# ClimatePolicy with a cross-contract view, so a freshly created policy can back
# a claim immediately. It can transiently fail on a view read inside a write, so
# this script retries rather than assuming one submission lands.
#
# Step 4 cannot be done from this shell. `record_evaluation` takes `evidence_json`
# as a STRING, and `genlayer write --args` strips every double quote out of a
# string argument -- verified: the contract reverted with
# "EXPECTED: invalid evidence JSON" for JSON that was valid before the CLI. Any
# argument that parses as an object is sent as a dict instead, and the call fails
# with "Missing or invalid parameters". Arrays pass through correctly, which is
# why create_policy's `source_ids` works. Use frontend/scripts/evaluate-claim.mjs, which
# signs with genlayer-js and sends the evidence as a real string.
set -euo pipefail

POLICY="${VITE_CLIMATEPOLICY_ADDRESS:-}"
CLAIM="${VITE_CLIMATECLAIM_ADDRESS:-}"
RPC="${VITE_GENLAYER_RPC_URL:-https://rpc-bradbury.genlayer.com}"
NETWORK="${VITE_GENLAYER_NETWORK_BRADBURY:-testnet-bradbury}"

die() { echo "ERROR: $*" >&2; exit 1; }

is_addr() { [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]; }
is_addr "$POLICY" || die "VITE_CLIMATEPOLICY_ADDRESS is unset or not a 0x address"
is_addr "$CLAIM"   || die "VITE_CLIMATECLAIM_ADDRESS is unset or not a 0x address"

genlayer network set "$NETWORK" >/dev/null
echo "network : $NETWORK ($RPC)"
echo "policy  : $POLICY"
echo "claim   : $CLAIM"

existing=$(genlayer call "$POLICY" list_policies 2>/dev/null | grep -o '\[\]' | head -1 || true)
if [[ "$existing" != "[]" ]]; then
  echo "Refusing to run: this deployment already has policies. Re-seeding would" >&2
  echo "create duplicates and mislabel them as fresh. Delete them on chain first." >&2
  exit 1
fi

say() { echo; echo "--- $1 ---"; }

say "1/5 register_source (two, so a source disagreement is representable)"
genlayer write "$POLICY" register_source --args \
  om_archive_precip "Open-Meteo Historical Weather API (ERA5 precipitation)" \
  open_meteo_archive precipitation precipitation_sum \
  "https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}&daily={param}&timezone=UTC" \
  mm "Open-Meteo (CC BY 4.0)"

genlayer write "$POLICY" register_source --args \
  nasa_power_precip "NASA POWER daily precipitation" \
  nasa_power precipitation PRECTOTCORR \
  "https://power.larc.nasa.gov/api/temporal/daily/point?parameters={param}&community=AG&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON" \
  mm "NASA POWER (CC BY 4.0)"

say "2/4 create_policy (Paris, 1.00 mm, historical simulation)"
# The claim period is bounded BY the policy, so both share one definition here
# rather than being written twice and drifting.
PERIOD_START="2024-06-01"
PERIOD_END="2024-06-05"
# Coordinates are MICRO-degrees: 1 degree = 1_000_000. Paris is 48.85 N, 2.35 E,
# so 48_850_000 and 2_350_000. Passing 488_500_000 reverts with
# "EXPECTED: invalid coordinates", which is the contract correctly refusing a
# latitude of 488 degrees.
POLICY_ID=$(genlayer write "$POLICY" create_policy --args \
  "Paris, France" 48850000 2350000 25000 \
  '["om_archive_precip","nasa_power_precip"]' unanimous 2 \
  historical_simulation "$PERIOD_START" "$PERIOD_END" UTC precipitation mm gt 100 \
  max_single "Any single day above 1.00 mm." 0 \
  | grep -oE '"policy-[0-9]+"' | tail -1 | tr -d '"')
[[ -n "$POLICY_ID" ]] || die "could not read the new policy id from create_policy"
echo "policy id: $POLICY_ID"

say "3/4 start_claim (no bridge step: the policy is read cross-contract)"
CLAIM_ID=$(genlayer write "$CLAIM" start_claim --args "$POLICY_ID" "$PERIOD_START" "$PERIOD_END" \
  | grep -oE '"claim-[0-9]+"' | tail -1 | tr -d '"')
[[ -n "$CLAIM_ID" ]] || die "could not read the new claim id from start_claim"
echo "claim id: $CLAIM_ID"

echo
echo "--- 4/4 record_evaluation needs genlayer-js, not this CLI ---"
echo "The claim is on chain in state 'created'. To give it a decision:"
echo
echo "    node frontend/scripts/evaluate-claim.mjs $CLAIM_ID"
echo
echo "That derives the decision with the deployed compute_evaluation and records"
echo "EXACTLY what it returned, so the decision is never chosen by hand. It needs"
echo "VITE_DEPLOYER_PRIVATE_KEY_BRADBURY in the repository-root .env."
echo "Note: evidence provenance is the caller's claim, not something the chain verified."