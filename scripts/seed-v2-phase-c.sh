#!/usr/bin/env bash
# Phase C: create a claim the live archive data actually CONFIRMS, then drive it
# through finalize -> settle.
#
# Why a new policy: the live Open-Meteo archive now returns max 0.90 mm for
# Paris 2024-06-01..05 (grid 48.8928,2.2920). The 1.00 mm policies (3 and 7)
# therefore do NOT cross, so claims 2 and 6 are honestly not_confirmed. A 0.50 mm
# threshold (scaled 50) is clearly crossed by 0.90 mm, with tolerance 12000 m so
# the ~5.97 km grid offset passes the location check. This is the confirmed +
# settlement demonstration. No reading is invented; the threshold is set below
# the real observed value.
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: phase-c.sh <contract-address>}"
PAYOUT="${2:-1000000}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"

echo "== create policy-8 (confirmed + payout demo, threshold 0.50 mm) =="
genlayer write "$A" create_policy --args \
  "Paris (confirmed payout demo)" 48856600 2352200 12000 \
  '["om_archive_precip"]' unanimous 1 historical_simulation \
  2024-06-01 2024-06-05 UTC precipitation mm gt 50 max_single \
  "Any day above 0.50 mm. Settles a real payout once final." "$PAYOUT" \
  > "$OUT/create-policy-8.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/create-policy-8.txt" | head -1 | sed 's/^/  tx /'

echo "== start claim-7 =="
genlayer write "$A" start_claim --args policy-8 2024-06-01 2024-06-05 \
  > "$OUT/start-claim-7.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/start-claim-7.txt" | head -1 | sed 's/^/  tx /'

echo "== evaluate claim-7 =="
genlayer write "$A" request_evaluation --args claim-7 \
  > "$OUT/eval-claim-7.txt" 2>&1
EVAL_TX=$(grep -oE "0x[a-fA-F0-9]{64}" "$OUT/eval-claim-7.txt" | head -1)
echo "  tx $EVAL_TX"

echo "== readback claim-7 =="
genlayer call "$A" get_claim --args claim-7 2>&1 | \
  grep -E "state:|decision:|reason_code:|observed_value_scaled:" | sed 's/^/  /'
echo "PHASE_C_PARTIAL_DONE"
