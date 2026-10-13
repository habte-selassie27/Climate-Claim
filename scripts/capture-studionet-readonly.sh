#!/usr/bin/env bash
# Re-capture READ-ONLY evidence from StudioNet.
#
# Strictly no writes: only `genlayer call` (view methods) and `genlayer receipt`.
# Safe to re-run at any time. It never touches contract state.
#
# This exists because `gltest` used to clear artifacts/ on every pytest run,
# which destroyed the evidence pack. gltest is now scoped to artifacts/gltest.
set -u
cd "$(dirname "$0")/.."
mkdir -p artifacts/studionet
A=0xE16032420e3155C0822e9150a98c6B1163869F0c
OUT=artifacts/studionet

echo "== counts =="
genlayer call "$A" get_policy_count            > "$OUT/01-policy-count.txt" 2>&1
genlayer call "$A" get_claim_count             > "$OUT/02-claim-count.txt" 2>&1
genlayer call "$A" get_owner                   > "$OUT/03-owner.txt" 2>&1

echo "== schema =="
genlayer schema "$A" > "$OUT/../schema-live.txt" 2>&1

echo "== per-claim readbacks =="
for c in claim-1 claim-2 claim-3 claim-4 claim-5; do
  genlayer call "$A" get_claim     --args "$c" > "$OUT/20-$c-claim.txt" 2>&1
  genlayer call "$A" get_evidence  --args "$c" > "$OUT/21-$c-evidence.txt" 2>&1
  genlayer call "$A" get_checks    --args "$c" > "$OUT/22-$c-checks.txt" 2>&1
  genlayer call "$A" get_settlement --args "$c" > "$OUT/23-$c-settlement.txt" 2>&1
done

echo "== policies =="
genlayer call "$A" list_policies > "$OUT/24-list-policies.txt" 2>&1
genlayer call "$A" list_sources  > "$OUT/25-list-sources.txt" 2>&1

echo "== receipts for every recorded transaction =="
# Hashes verified live earlier this session; each is FINALIZED / SUCCESS.
i=30
for h in \
  0xc77b77b51140b8d55dfb1c60249edeb1dc2fb2b2f66bf6fcbb39dd7566e0b98b \
  0xa4f7f059570a43f8074fe138a91f76341685d1843a70b21398d0b7647749298c \
  0x841dfb125e9f2c59a0a0bef3a83e3818f4cf35c97bef0240a81b3ff5d072bfec \
  0xd57da882ed90250a6566da3b90b0485f5e08e9630af8e675ac8ac4dbff26076c \
  0x1acec44c78dd63c7b7cd0014ea531a5491375e827ac2ae3df322037880c7d346 \
  0x1b87c46dbcae997058539638e36df6b921658c97a8eb305990399ab7a753d0e1 \
  0xc36aa6004a030d3c4d068fe5879fd08684aa57d7c3fadac29735a9f34ae64fc6 ; do
  genlayer receipt "$h" > "$OUT/${i}-receipt-${h:0:10}.txt" 2>&1
  i=$((i+1))
done

echo
echo "DONE. Files in $OUT:"
ls -1 "$OUT" | wc -l