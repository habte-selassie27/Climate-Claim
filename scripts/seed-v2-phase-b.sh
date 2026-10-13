#!/usr/bin/env bash
# Phase B: evaluate the seeded claims. Each request_evaluation is a consensus
# write where the leader and validators fetch the sources independently.
#
# Expected outcomes (Paris ERA5 daily precip 2024-06-01..05, max 1.20 mm):
#   claim-1 policy-1 nasa threshold 2.00 tol 5000  -> confirmed or not (nasa data)
#   claim-2 policy-3 om   threshold 1.00 tol 12000 -> confirmed (1.20 > 1.00)
#   claim-4 policy-4 om   threshold 5.00 tol 5000  -> inconclusive (location_mismatch)
#   claim-5 policy-5 om   threshold 5.00 tol 12000 -> not_confirmed (1.20 < 5.00)
#   claim-6 policy-7 om   threshold 1.00 tol 12000 -> confirmed (settlement target)
# claim-3 (policy-2) is intentionally left unevaluated -> state "created".
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: phase-b.sh <contract-address>}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"

EV() { # $1=claim
  echo "== evaluate $1 =="
  genlayer write "$A" request_evaluation --args "$1" \
    > "$OUT/eval-$1.txt" 2>&1
  grep -oE "0x[a-fA-F0-9]{64}" "$OUT/eval-$1.txt" | head -1 | sed 's/^/  tx /'
  grep -oE "status_name: '[A-Z_]+'" "$OUT/eval-$1.txt" | head -1 | sed 's/^/  /'
}

EV claim-2
EV claim-4
EV claim-5
EV claim-6
EV claim-1

echo "== readback =="
genlayer call "$A" list_claims > "$OUT/phase-b-claims.txt" 2>&1
for c in claim-1 claim-2 claim-4 claim-5 claim-6; do
  genlayer call "$A" get_claim --args "$c" 2>&1 | \
    grep -E "id:|state:|decision:|reason_code:|observed_value_scaled:|eval_round:" | \
    tr '\n' ' ' | sed 's/^/  /'; echo
done
echo "PHASE_B_DONE"
