#!/usr/bin/env bash
# Poll StudioNet until the hourly READ bucket frees, then redeploy.
#
# WHY A SEPARATE SCRIPT: the blocker is not the daily write quota (5000/day)
# that we originally hit. As of 2026-10-17 the hourly READ bucket
# (`bucket: standard, window: hour, limit: 500`) is pinned at 500/500 and does
# not drain, even after 70s of complete idle. Deploying requires reads -- gas
# estimate, nonce, receipt polling -- so the deploy cannot start until reads
# work. Until then there is no way to learn whether the daily write quota has
# also reset, because the request never gets that far.
#
# WHY THE PROBE INTERVAL IS 150s, NOT 10s: if rejected requests count toward
# the bucket, frequent probing is precisely what keeps this session locked out.
# At 150s that is ~24 probes/hour against a 500 budget -- negligible, and it
# leaves the bucket free for the deploy itself, which makes many calls.
#
# The deploy fires only after a probe returns a real JSON-RPC result (no -32029),
# not merely after the cooldown number looks small. A "retry_after_seconds: 15"
# that never actually frees a slot has already been observed, so the countdown
# is not trusted.
#
# USAGE
#   scripts/wait-and-redeploy-studionet.sh              # poll up to 90 minutes
#   MAX_WAIT_MIN=10 scripts/wait-and-redeploy-studionet.sh
#
# Exits 0 on a successful deploy, 1 on timeout or deploy failure.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=https://studio.genlayer.com/api
PROBE_ADDR=0x6E4BD06bD969E745546A7957d818eDaD47882ea8
# (no probe slot needed: the schema call takes only an address)
INTERVAL=150
MAX_WAIT_MIN=${MAX_WAIT_MIN:-90}
LOG=artifacts/studionet-wait.log

mkdir -p artifacts
: > "$LOG"

log() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG"; }

log "polling StudioNet read bucket every ${INTERVAL}s for up to ${MAX_WAIT_MIN}m"
log "log: $LOG"

# Returns 0 when the `standard` bucket serves a real result.
#
# PROBE CHOICE, which was wrong on the first attempt and matters: `eth_chainId`
# is NOT a valid probe. It answers fine (0xf22f = 61999, StudioNet) while the
# `standard` bucket is still exhausted, because plain JSON-RPC is not rate
# limited the way the heavier GenLayer methods are. Probing with it would have
# reported "free" and fired the deploy straight into the same wall.
#
# `gen_getContractSchema` hits exactly the bucket `genlayer deploy` needs (it is
# the same call the post-deploy schema capture makes), so it is the honest
# signal. `gen_getStorage` was also tried and does not exist on StudioNet at
# all (-32601), which would have made the probe never report success.
bucket_free() {
  local body
  body=$(curl -s -m 25 -X POST "$RPC" \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"gen_getContractSchema\",\"id\":1,\"params\":[\"$PROBE_ADDR\"]}" \
    2>/dev/null || true)
  # -32029 is the rate-limit code. Anything else with a result means reads work.
  # UNQUOTED, and this matters: the RPC emits `"code":-32029`, not
  # `"code":"-32029"`. Grepping for the quoted form matched nothing, so every
  # rate-limited probe fell through to the `unexpected` branch below and the
  # retry countdown was never surfaced. It still returned "blocked", so the
  # outcome was right by luck rather than by logic.
  if printf '%s' "$body" | grep -q -- '-32029'; then
    local retry
    retry=$(printf '%s' "$body" | grep -oE '"retry_after_seconds":[0-9]+' | grep -oE '[0-9]+' || echo "?")
    printf 'standard bucket limited (retry_after %ss)' "$retry"
    return 1
  fi
  if printf '%s' "$body" | grep -q '"result"'; then
    return 0
  fi
  printf 'unexpected: %s' "$(printf '%s' "$body" | head -c 120)"
  return 1
}

DEADLINE=$(( $(date +%s) + MAX_WAIT_MIN * 60 ))
ATTEMPT=0

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if STATUS=$(bucket_free); then
    log "probe $ATTEMPT: READS WORK -- read bucket has freed"
    log "read proof: $STATUS"
    break
  fi
  log "probe $ATTEMPT: $STATUS"
  sleep "$INTERVAL"
done

if [ "$(date +%s)" -ge "$DEADLINE" ]; then
  log "TIMEOUT after ${MAX_WAIT_MIN}m ($ATTEMPT probes) -- read bucket never freed"
  log "StudioNet remains unusable for deploys; nothing was written"
  exit 1
fi

log "running gates before deploying (lint pinned, then direct tests)"
# Re-run the gates here rather than trusting the earlier run: this script may sit
# idle for over an hour, and deploying unlinted code is the wrong order.
if ! GENVM_VERSION=v0.3.0-rc7 genvm-lint check archive/climateclaim.py; then
  log "lint failed -- not deploying"
  exit 1
fi
if ! python3.12 -m pytest archive/tests -q; then
  log "direct tests failed -- not deploying"
  exit 1
fi

log "gates green -- handing off to redeploy-studionet.sh"
SKIP_GATES=1 ./scripts/redeploy-studionet.sh 2>&1 | tee -a "$LOG"