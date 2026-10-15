#!/usr/bin/env bash
# Phase D retry: the first finalize_decision hit CONSENSUS_LEADER_EXEC_TIMEOUT
# (transient StudioNet RPC errors in the same window). Retry, verify finality
# landed, then settle.
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: phase-d2.sh <contract-address>}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"

echo "== retry finalize_decision(claim-7) =="
genlayer write "$A" finalize_decision --args claim-7 \
  > "$OUT/finalize-claim-7-retry.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/finalize-claim-7-retry.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/finalize-claim-7-retry.txt" | head -1 | sed 's/^/  /'
grep -oE "error_code: '[A-Z_]+'" "$OUT/finalize-claim-7-retry.txt" | head -2 | sed 's/^/  ! /'

echo "== readback after finalize =="
genlayer call "$A" get_claim --args claim-7 2>&1 | \
  grep -E "state:|decision:|finalized:|settlement_state:" | sed 's/^/  /'

echo "== settle_claim(claim-7) =="
genlayer write "$A" settle_claim --args claim-7 \
  > "$OUT/settle-claim-7-retry.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/settle-claim-7-retry.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/settle-claim-7-retry.txt" | head -1 | sed 's/^/  /'
grep -oE "execution_result: '[A-Z]+'" "$OUT/settle-claim-7-retry.txt" | sort | uniq -c | sed 's/^/  /'

echo "== final readback =="
genlayer call "$A" get_claim --args claim-7 2>&1 | \
  grep -E "state:|decision:|finalized:|settlement_state:" | sed 's/^/  /'
genlayer call "$A" get_settlement --args claim-7 2>&1 | \
  grep -E "state:|amount:|beneficiary:|finalized:" | sed 's/^/  settlement: /'
echo "PHASE_D2_DONE"
