#!/usr/bin/env bash
# Redeploy ClimateClaim to StudioNet, then capture the schema and a read proof.
#
# WHY THIS EXISTS: the deployed v2 contract predates the audit fixes, so it lacks
# `confirm_settlement`, `fail_settlement`, `get_in_flight`, `get_refunds`,
# `get_payouts` and `get_source_count`. The UI maps all six, so the payout
# confirm/fail path cannot work until the contract is redeployed. This script does
# the whole sequence so it is one command when the quota resets.
#
# GATES ARE NOT SKIPPED. Run them first; deploying unlinted code to the chain you
# link from your README is the wrong order. Set SKIP_GATES=1 only if you have
# already run them in this session.
#
# REQUIREMENTS
#   - network: studionet (gasless; 0 GEN is expected and fine)
#   - account: the contract owner. The private key lives in the gitignored `.env`
#     as VITE_DEPLOYER_PRIVATE_KEY and must be imported into the CLI first; this
#     script never prints it and never accepts it as an argument.
#
# USAGE
#   scripts/redeploy-studionet.sh
#
# IF IT FAILS WITH "Rate limit exceeded: 5000 requests per day"
#   StudioNet's daily WRITE quota is spent. The error carries
#   `retry_after_seconds`; wait that long. Reads still work meanwhile.
set -euo pipefail
cd "$(dirname "$0")/.."

# The pre-split single contract. It is not in contracts/ any more -- that
# directory holds only the two DEPLOYED contracts -- so this script, which
# deploys the monolith to StudioNet, reads it from archive/.
CONTRACT=archive/climateclaim.py
OWNER=0x5B3661C576c7001e6d6279C67F3779705d334c89
ENVFILE=.env

echo "== gates =="
if [ "${SKIP_GATES:-0}" = "1" ]; then
  echo "SKIP_GATES=1 — skipping lint and direct tests"
else
  GENVM_VERSION=v0.3.0-rc7 genvm-lint check "$CONTRACT"
  # genlayer_py needs Python 3.12+ (collections.abc.Buffer).
  # The archived suite, because this script deploys the archived contract.
  # tests/direct/ holds only the config drift checks.
  python3.12 -m pytest archive/tests -q
fi

echo
echo "== network =="
genlayer network set studionet

echo
echo "== account (must be the owner $OWNER) =="
# Local-only selection: finds the owner's keystore account and makes it active
# (account list/use never touch the RPC, so this works even while the daily
# quota is spent). Exits 1 with the import command if no local account matches.
./scripts/select-owner-account.sh || exit 1

echo
echo "== deploy =="
OUT=$(genlayer deploy --contract "$CONTRACT" --args "$OWNER" 2>&1) || {
  echo "$OUT"
  echo >&2
  echo "Deploy failed. If it says 'Rate limit exceeded: 5000 requests per day'," >&2
  echo "the daily write quota is spent — wait retry_after_seconds and re-run." >&2
  exit 1
}
echo "$OUT"

ADDR_NEW=$(printf '%s' "$OUT" | grep -oE "0x[0-9a-fA-F]{40}" | head -1)
if [ -z "$ADDR_NEW" ]; then
  echo "ERROR: could not parse the new contract address from the deploy output." >&2
  exit 1
fi

echo
echo "== capture schema =="
genlayer schema "$ADDR_NEW" > docs/schema.genlayer-cli.txt
echo "saved docs/schema.genlayer-cli.txt"

echo
echo "== read proof =="
genlayer call "$ADDR_NEW" get_owner
genlayer call "$ADDR_NEW" get_criteria_version
genlayer call "$ADDR_NEW" get_policy_count

echo
echo "== confirm the methods the UI needs now exist =="
for m in confirm_settlement fail_settlement get_in_flight get_refunds get_payouts get_source_count; do
  if grep -qE "^    $m: \{" docs/schema.genlayer-cli.txt; then
    echo "  present  $m"
  else
    echo "  MISSING  $m"
  fi
done

cat <<EOF

== next steps (manual, by design) ==

1. Update the address in frontend/src/config/contracts.ts:
     CONTRACT_ADDRESS = "$ADDR_NEW"
   and remove the STALENESS WARNING block, since this deployment has it.

2. Update VITE_CLIMATECLAIM_ADDRESS in .env AND .env.example to $ADDR_NEW.
   Then run:  python3.12 -m pytest tests/direct/test_env_consistency.py
   It fails if .env, .env.example, the gltest yaml and the typed fallback drift
   apart — that test is the guard, so do not skip it.

3. Push and redeploy the site so the browser picks up the new address.

NEW CONTRACT ADDRESS: $ADDR_NEW
EOF