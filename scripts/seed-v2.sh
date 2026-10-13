#!/usr/bin/env bash
# Re-seed the v2 deployment with the documented ClimateClaim scenario set.
#
# Preserves the claim-id mapping the demo fixtures reference:
#   claim-2 (confirmed), claim-4 (location_mismatch), claim-5 (not_confirmed)
# Claim ids are assigned by claim_counter in start_claim order, so the order
# below is policy-1, policy-3, policy-2, policy-4, policy-5, then policy-7.
#
# Also seeds the two NEW on-chain demonstrations:
#   - policy-7 / claim-6: payout_amount > 0 -> finalized -> settled
#   - dispute-grounds fix demonstrated on claim-5 (real text preserved)
#
# Historical Paris ERA5 daily precipitation 2024-06-01..05: max 1.20 mm.
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: seed-v2.sh <contract-address>}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"
MANIFEST="$OUT/tx-manifest.txt"
: > "$MANIFEST"

txhash() { grep -oE "0x[a-fA-F0-9]{64}" "$1" | head -1; }
note() { echo "$2 $(txhash "$1")" >> "$MANIFEST"; echo "  -> $2 $(txhash "$1")"; }

# create_policy: location lat lon tolerance sources agreement min_sources mode
#                start end tz metric unit comparator threshold aggregation condition payout
POL() { # $1=name $2=tolerance $3=sources $4=threshold $5=condition $6=payout
  genlayer write "$A" create_policy --args \
    "$1" 48856600 2352200 "$2" "$3" unanimous 1 historical_simulation \
    2024-06-01 2024-06-05 UTC precipitation mm gt "$4" max_single "$5" "$6" \
    > "$OUT/tmp-create-$1.txt" 2>&1
  note "$OUT/tmp-create-$1.txt" "create_policy($1)"
}

echo "== Phase A: policies =="
POL "Paris"                5000  '["nasa_precip"]'    200 "Any day with precipitation above 2.00 mm." 0   # policy-1
POL "Paris"                5000  '["om_archive_precip"]' 0   "Any rain at all." 0                                    # policy-2
POL "Paris"                12000 '["om_archive_precip"]' 100 "Any day above 1.00 mm." 0                              # policy-3
POL "Paris (not-confirmed demo)" 5000  '["om_archive_precip"]' 500 "Any day with precipitation above 5.00 mm." 0   # policy-4
POL "Paris (not-confirmed demo)" 12000 '["om_archive_precip"]' 500 "Any day with precipitation above 5.00 mm." 0   # policy-5
POL "Paris (not-confirmed demo)" 12000 '["om_archive_precip"]' 500 "Any day with precipitation above 5.00 mm." 0   # policy-6 (retired below)
POL "Paris (settlement demo)"    12000 '["om_archive_precip"]' 100 "Any day above 1.00 mm. Settles a real payout when finalized." 1000000 # policy-7

echo "== Phase A: retire policy-6 =="
genlayer write "$A" retire_policy --args policy-6 > "$OUT/tmp-retire-policy-6.txt" 2>&1
note "$OUT/tmp-retire-policy-6.txt" "retire_policy(policy-6)"

echo "== Phase A: claims (id-assigning order) =="
CL() { # $1=policy $2=start $3=end
  genlayer write "$A" start_claim --args "$1" "$2" "$3" > "$OUT/tmp-claim-$1.txt" 2>&1
  note "$OUT/tmp-claim-$1.txt" "start_claim($1)"
}
CL policy-1 2024-06-01 2024-06-05   # claim-1
CL policy-3 2024-06-01 2024-06-05   # claim-2
CL policy-2 2024-06-01 2024-06-05   # claim-3 (left unevaluated -> created)
CL policy-4 2024-06-01 2024-06-05   # claim-4
CL policy-5 2024-06-01 2024-06-05   # claim-5
CL policy-7 2024-06-01 2024-06-05   # claim-6 (settlement target)

echo "== Phase A: verify =="
genlayer call "$A" list_policies > "$OUT/verify-policies.txt" 2>&1
genlayer call "$A" list_claims   > "$OUT/verify-claims.txt" 2>&1
grep -c "id: 'policy-" "$OUT/verify-policies.txt" | sed 's/^/  policies: /'
grep -oE "id: 'claim-[0-9]'" "$OUT/verify-claims.txt" | tr '\n' ' '; echo
echo "PHASE_A_DONE"
