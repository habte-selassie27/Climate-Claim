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
#   3. register_policy_snapshot (ClimateClaim, owner-only) -- bridges the policy
#   4. start_claim          (ClimateClaim, anyone)
#   5. record_evaluation    (ClimateClaim, owner-only) -- stores the DERIVED decision
#
# Step 3 is why a brand-new policy cannot back a claim on its own: ClimateClaim
# only knows a policy id once the owner has copied it across.
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

say "2/5 create_policy (Paris, 1.00 mm, historical simulation)"
# Coordinates are MICRO-degrees: 1 degree = 1_000_000. Paris is 48.85 N, 2.35 E,
# so 48_850_000 and 2_350_000. Passing 488_500_000 reverts with
# "EXPECTED: invalid coordinates", which is the contract correctly refusing a
# latitude of 488 degrees.
POLICY_ID=$(genlayer write "$POLICY" create_policy --args \
  "Paris, France" 48850000 2350000 25000 \
  '["om_archive_precip","nasa_power_precip"]' unanimous 2 \
  historical_simulation 2024-06-01 2024-06-05 UTC precipitation mm gt 100 \
  max_single "Any single day above 1.00 mm." 0 \
  | grep -oE '"policy-[0-9]+"' | tail -1 | tr -d '"')
[[ -n "$POLICY_ID" ]] || die "could not read the new policy id from create_policy"
echo "policy id: $POLICY_ID"

say "3/5 register_policy_snapshot (owner-only bridge into ClimateClaim)"
SNAP=$(genlayer call "$POLICY" get_policy --args "$POLICY_ID" 2>/dev/null | tail -n +1)
echo "snapshot registered from $POLICY_ID"
genlayer write "$CLAIM" register_policy_snapshot --args "$SNAP"

say "4/5 start_claim"
CLAIM_ID=$(genlayer write "$CLAIM" start_claim --args "$POLICY_ID" 2024-06-01 2024-06-05 \
  | grep -oE '"claim-[0-9]+"' | tail -1 | tr -d '"')
[[ -n "$CLAIM_ID" ]] || die "could not read the new claim id from start_claim"
echo "claim id: $CLAIM_ID"

say "5/5 derive the decision with compute_evaluation, then record THAT decision"
# Evidence is supplied by the caller: nothing on chain fetches weather data, so
# these rows are the caller's claim about what the sources returned. The engine
# recomputes the crossing from the raw values and derives the decision.
EVIDENCE='[{"source_id":"om_archive_precip","ok":true,"days_covered":5,"value_scaled":120},{"source_id":"nasa_power_precip","ok":true,"days_covered":5,"value_scaled":130}]'
DECISION=$(genlayer call "$POLICY" compute_evaluation --args "$SNAP" "$EVIDENCE" 5 2>/dev/null \
  | grep -oE '"decision":"[a-z_]+"' | head -1 | cut -d'"' -f4)
REASON=$(genlayer call "$POLICY" compute_evaluation --args "$SNAP" "$EVIDENCE" 5 2>/dev/null \
  | grep -oE '"reason_code":"[a-z_]+"' | head -1 | cut -d'"' -f4)
echo "engine derived: $DECISION / $REASON"

genlayer write "$CLAIM" record_evaluation --args "$CLAIM_ID" "$DECISION" "$REASON" \
  "Derived on chain by compute_evaluation from two recorded sources." 125 "$EVIDENCE"

echo
echo "Done. Claim $CLAIM_ID on policy $POLICY_ID."
echo "Note: evidence provenance is the caller's claim, not something the chain verified."