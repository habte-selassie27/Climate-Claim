#!/usr/bin/env bash
# Live-mode claim: a policy whose observation window ENDS TODAY, evaluated
# against the documented live endpoint (Open-Meteo forecast API, registered as
# `om_forecast_precip`, kind `open_meteo_forecast`). This is what makes
# `data_mode: "live"` a demonstrated mode rather than a theoretical label.
#
# NOT EXECUTED YET. Written 2026-10-16 while StudioNet's public RPC was rate
# limited (5,000 requests/day bucket, reset ~19:15 UTC). The commands mirror the
# verified pattern used by seed-v2.sh / seed-sources.sh; the first run is its
# real test.
#
# WHY A REDEPLOY IS REQUIRED FIRST: live policies accept only forecast-kind
# sources, and KIND_FORECAST landed in commit e085b19 (2026-10-15) — after the
# deployed v2. Sequence:
#   1. scripts/redeploy-studionet.sh          (deploy current source, gate-checked)
#   2. update the address in frontend/src/config/contracts.ts + .env / .env.example
#   3. scripts/live-claim.sh <new-address>
#
# USAGE: scripts/live-claim.sh <contract-address>
set -u
cd "$(dirname "$0")/.."
A="${1:?usage: live-claim.sh <contract-address>}"
OUT=artifacts/studionet-live
mkdir -p "$OUT"

END=$(date -u +%F)
START=$(date -u -d '4 days ago' +%F)
echo "live window: $START .. $END (UTC — a live policy's window must reach today)"

echo
echo "== endpoint check (independent curl, kept for the record) =="
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.505&longitude=-0.055&daily=precipitation_sum&past_days=5&forecast_days=1&timezone=UTC" \
  > "$OUT/endpoint-check.json" 2>&1
head -c 400 "$OUT/endpoint-check.json"; echo

echo
echo "== step 1: ensure the source registry (idempotent; skips registered) =="
./scripts/seed-sources.sh "$A" > "$OUT/seed-sources.txt" 2>&1 || {
  echo "seed-sources.sh failed — see $OUT/seed-sources.txt" >&2
  exit 1
}
grep -E "already registered|registering" "$OUT/seed-sources.txt" | sed 's/^/  /'
genlayer call "$A" get_source --args om_forecast_precip 2>&1 | head -8 | sed 's/^/  /'

echo
echo "== step 2: create the live policy (gte 2.00 mm, max_single, unanimous) =="
POL_BEFORE=$(genlayer call "$A" get_policy_count 2>&1 | grep -oE "[0-9]+" | head -1)
POL_BEFORE="${POL_BEFORE:-0}"
genlayer write "$A" create_policy --args \
  "London (live)" 51505000 -55000 10000 '["om_forecast_precip"]' unanimous 1 live \
  "$START" "$END" UTC precipitation mm gte 200 max_single \
  "Any single day at or above 2.00 mm in the live window ending today." 0 \
  > "$OUT/create-live-policy.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/create-live-policy.txt" | head -1 | sed 's/^/  tx /'
grep -iE "error|revert|invalid|EXPECTED|rate limit" "$OUT/create-live-policy.txt" | head -3 | sed 's/^/  ! /'
POL_AFTER=$(genlayer call "$A" get_policy_count 2>&1 | grep -oE "[0-9]+" | head -1)
POL_AFTER="${POL_AFTER:-0}"
if [ "$POL_AFTER" -le "$POL_BEFORE" ]; then
  echo "ERROR: policy count did not grow ($POL_BEFORE -> $POL_AFTER); inspect $OUT/create-live-policy.txt" >&2
  exit 1
fi
POLICY="policy-$POL_AFTER"
echo "  new policy: $POLICY"

echo
echo "== step 3: start the claim over the same window =="
genlayer write "$A" start_claim --args "$POLICY" "$START" "$END" > "$OUT/start-live-claim.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/start-live-claim.txt" | head -1 | sed 's/^/  tx /'
grep -iE "error|revert|invalid|EXPECTED|rate limit" "$OUT/start-live-claim.txt" | head -3 | sed 's/^/  ! /'
CLAIM=$(genlayer call "$A" list_claims 2>&1 | grep -oE "claim-[0-9]+" | sort -V | tail -1)
echo "  new claim: ${CLAIM:-none}"

echo
echo "== step 4: evaluate under consensus (leader fetches live, validators re-fetch) =="
genlayer write "$A" request_evaluation --args "$CLAIM" > "$OUT/evaluate-live-claim.txt" 2>&1
grep -oE "0x[a-fA-F0-9]{64}" "$OUT/evaluate-live-claim.txt" | head -1 | sed 's/^/  tx /'
grep -oE "status_name: '[A-Z_]+'" "$OUT/evaluate-live-claim.txt" | head -1 | sed 's/^/  /'
grep -iE "error|revert|invalid|EXPECTED|LLM_ERROR|EXTERNAL|rate limit" "$OUT/evaluate-live-claim.txt" | head -3 | sed 's/^/  ! /'

echo
echo "== readback =="
genlayer call "$A" get_claim --args "$CLAIM" 2>&1 | \
  grep -E "id:|state:|decision:|reason_code:|observed_value_scaled:|eval_round:|eval_error:|finalized:" | sed 's/^/  /'
genlayer call "$A" get_evidence --args "$CLAIM" 2>&1 | head -20 | sed 's/^/  /'

echo
echo "Hold these readings next to $OUT/endpoint-check.json: the contract's"
echo "per-day values must match the endpoint's response for the same window."
echo "LIVE_CLAIM_DONE"
