#!/usr/bin/env bash
# Capture a real "not confirmed" scenario on StudioNet.
#
# policy-4 above accidentally produced location_mismatch because its tolerance
# was 5000 m while the ERA5 grid cell sits ~5.97 km from the policy point. For a
# clean not_confirmed run the tolerance must be wide enough (12000 m, as used by
# policy-3) so the location check passes and only the threshold decides.
#
# Real Paris ERA5 daily precipitation for 2024-06-01..05 (verified live):
#   1.20, 0.00, 0.10, 0.80, 0.50  -> max 1.20 mm
# A 5.00 mm threshold is therefore clearly not met.
set -u
cd "$(dirname "$0")/.."
mkdir -p artifacts/studionet
A=0xE16032420e3155C0822e9150a98c6B1163869F0c
OUT=artifacts/studionet

genlayer write "$A" create_policy \
  --args "Paris (not-confirmed demo)" 48856600 2352200 12000 \
  '["om_archive_precip"]' unanimous 1 historical_simulation \
  2024-06-01 2024-06-05 UTC precipitation mm gt 500 max_single \
  "Any day with precipitation above 5.00 mm." 0 \
  > "$OUT/10-create-policy-not-confirmed.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/10-create-policy-not-confirmed.txt" | head -1

genlayer write "$A" start_claim --args policy-5 2024-06-01 2024-06-05 \
  > "$OUT/11-start-claim-5.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/11-start-claim-5.txt" | head -1

genlayer write "$A" request_evaluation --args claim-5 \
  > "$OUT/12-evaluate-claim-5.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/12-evaluate-claim-5.txt" | head -1

genlayer call "$A" get_claim --args claim-5  > "$OUT/13-claim-5-readback.txt" 2>&1
genlayer call "$A" get_checks --args claim-5  > "$OUT/14-claim-5-checks.txt" 2>&1
genlayer call "$A" get_evidence --args claim-5 > "$OUT/15-claim-5-evidence.txt" 2>&1
cat "$OUT/13-claim-5-readback.txt"
echo "DONE"