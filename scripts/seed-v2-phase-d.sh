#!/usr/bin/env bash
# Phase D: walk the settlement path end to end on claim-7 (the confirmed,
# payout-configured claim). This is the demonstration the audit said was
# missing: finalize_decision then settle_claim on a real finalized decision.
#
#   1. fund()  — payable, deposits native token so the contract can pay out.
#   2. finalize_decision(claim-7) — owner only; re-reads the decision at
#      LATEST_FINAL and requires it to match the recorded one.
#   3. settle_claim(claim-7) — owner only; idempotent, finality-gated, moves
#      not_settled -> settling -> settled around the transfer.
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: phase-d.sh <contract-address>}"
PAYOUT="${2:-1000000}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"

echo "== fund contract (payable, --fee-value carries the deposit) =="
# Over-fund slightly so the payout (1000000) is comfortably covered.
genlayer write "$A" fund --fee-value $((PAYOUT * 2)) \
  > "$OUT/fund.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/fund.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/fund.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid" "$OUT/fund.txt" | head -3 | sed 's/^/  ! /'

echo "== finalize_decision(claim-7) =="
genlayer write "$A" finalize_decision --args claim-7 \
  > "$OUT/finalize-claim-7.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/finalize-claim-7.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/finalize-claim-7.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid" "$OUT/finalize-claim-7.txt" | head -3 | sed 's/^/  ! /'

echo "== readback after finalize =="
genlayer call "$A" get_claim --args claim-7 2>&1 | \
  grep -E "state:|decision:|finalized:|settlement_state:" | sed 's/^/  /'

echo "== settle_claim(claim-7) =="
genlayer write "$A" settle_claim --args claim-7 \
  > "$OUT/settle-claim-7.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/settle-claim-7.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/settle-claim-7.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid|transfer" "$OUT/settle-claim-7.txt" | head -5 | sed 's/^/  ! /'

echo "== readback after settle =="
genlayer call "$A" get_claim --args claim-7 2>&1 | \
  grep -E "state:|decision:|finalized:|settlement_state:" | sed 's/^/  /'
genlayer call "$A" get_settlement --args claim-7 2>&1 | \
  grep -E "state:|amount:|beneficiary:|finalized:" | sed 's/^/  settlement: /'
echo "PHASE_D_DONE"
