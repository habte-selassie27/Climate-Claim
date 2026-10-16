#!/usr/bin/env bash
# Live dispute round: open a dispute on a decided, unsettled claim and resolve
# it (which re-evaluates under consensus), then read the dispute history back.
#
# NOT EXECUTED YET. Written 2026-10-16 while StudioNet's public RPC was rate
# limited (5,000 requests/day bucket, reset ~19:15 UTC). The commands mirror
# the verified pattern used by seed-v2-phase-b.sh / seed-v2-phase-d.sh; run
# after the reset (or from a network with budget):
#
#   scripts/dispute-claim.sh <contract-address> [claim-id] ["grounds"]
#
# Expected effect, per contracts/climateclaim.py:
#   open_dispute    -> state "disputed", pending_grounds set, dispute_rounds + 1
#   resolve_dispute -> re-evaluation; the completed round lands in get_disputes
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: dispute-claim.sh <contract-address> [claim-id] [grounds]}"
CLAIM="${2:-claim-2}"
GROUNDS="${3:-Re-check the station match: the recorded grid distance is within the policy tolerance.}"
OUT=artifacts/studionet-v2
mkdir -p "$OUT"

# open_dispute/resolve_dispute are party actions and the seeded claimant is the
# owner account; make sure the active CLI account is that one (local, no RPC).
./scripts/select-owner-account.sh || exit 1

echo "== open_dispute($CLAIM) =="
genlayer write "$A" open_dispute --args "$CLAIM" "$GROUNDS" \
  > "$OUT/dispute-open-$CLAIM.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/dispute-open-$CLAIM.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/dispute-open-$CLAIM.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid|EXPECTED" "$OUT/dispute-open-$CLAIM.txt" | head -3 | sed 's/^/  ! /'

echo "== readback after open =="
genlayer call "$A" get_claim --args "$CLAIM" 2>&1 | \
  grep -E "id:|state:|decision:|finalized:|eval_round:|pending_grounds:" | sed 's/^/  /'

echo "== resolve_dispute($CLAIM) (consensus re-evaluation) =="
genlayer write "$A" resolve_dispute --args "$CLAIM" \
  > "$OUT/dispute-resolve-$CLAIM.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/dispute-resolve-$CLAIM.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/dispute-resolve-$CLAIM.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid|EXPECTED" "$OUT/dispute-resolve-$CLAIM.txt" | head -3 | sed 's/^/  ! /'

echo "== readback after resolve =="
genlayer call "$A" get_disputes --args "$CLAIM" 2>&1 | head -30 | sed 's/^/  /'
genlayer call "$A" get_claim --args "$CLAIM" 2>&1 | \
  grep -E "id:|state:|decision:|eval_round:" | sed 's/^/  /'
echo "DISPUTE_DONE"
