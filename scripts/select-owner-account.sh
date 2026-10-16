#!/usr/bin/env bash
# Make the contract owner's LOCAL account active for CLI writes.
#
# WHY: CLI writes sign with the active account, and every seeded demo plus every
# owner-only method needs the owner key. During the 2026-10-16 quota wait the
# active account had drifted (a bradbury key), which would have failed the
# redeploy at the account check.
#
# `account list` and `account use` are LOCAL commands (no RPC), so this works
# even while the daily StudioNet quota is spent.
#
# EXIT: 0 with the active line echoed when the owner is (made) active;
#       1 with the exact import command when no local account matches.
set -u
cd "$(dirname "$0")/.."
OWNER=0x5B3661C576c7001e6d6279C67F3779705d334c89
OWNER_LC=$(printf '%s' "$OWNER" | tr 'A-Z' 'a-z')

ACTIVE=$(genlayer account list 2>/dev/null | grep "(active)" | head -1) || ACTIVE=""
if printf '%s' "$ACTIVE" | grep -qi "$OWNER_LC"; then
  echo "active account: $ACTIVE"
  exit 0
fi

CAND=$(genlayer account list 2>/dev/null | grep -i "$OWNER_LC" | head -1) || CAND=""
if [ -z "$CAND" ]; then
  echo "ERROR: no local account matches the contract owner $OWNER." >&2
  echo "Import it, then re-run this script:" >&2
  echo "  set -a; . ./.env; set +a" >&2
  echo "  genlayer account import --private-key \"\$VITE_DEPLOYER_PRIVATE_KEY\"" >&2
  exit 1
fi

CAND_NAME=$(printf '%s' "$CAND" | sed 's/^[*[:space:]]*//' | awk '{print $1}')
genlayer account use "$CAND_NAME" >/dev/null

ACTIVE=$(genlayer account list 2>/dev/null | grep "(active)" | head -1) || ACTIVE=""
if ! printf '%s' "$ACTIVE" | grep -qi "$OWNER_LC"; then
  echo "ERROR: selected '$CAND_NAME' but the active account is still: $ACTIVE" >&2
  exit 1
fi
echo "active account: $ACTIVE"
