#!/usr/bin/env bash
# Bring up the GenLayer localnet with the database-migration fix applied.
#
# WHY NOT JUST `genlayer up`: it fails, every time, with
#
#   connection to server at "localhost" (::1), port 5432 failed: Connection refused
#
# because genlayer's compose passes the migration a DB_URL that its image
# ignores. See deploy/localnet-migration.override.yml for the full explanation.
#
# This runs the same compose command the CLI runs, with our override layered on
# last so it wins. Nothing inside node_modules is modified, so reinstalling the
# CLI cannot silently undo it.
#
# REQUIRES host port 5432 to be free. The localnet maps postgres to 5432 and
# `genlayer up` has no flag to change it, so a local PostgreSQL service must be
# stopped first.
#
# USAGE
#   scripts/localnet-up.sh              # start
#   scripts/localnet-up.sh --reset-db   # start with a fresh database
#   scripts/localnet-down.sh            # stop and clean up
set -euo pipefail
cd "$(dirname "$0")/.."

# `command -v genlayer` resolves to <pkg>/dist/index.js, so the package root is
# two levels up from the binary's own directory.
GENLAYER_BIN=$(readlink -f "$(command -v genlayer)")
GENLAYER_DIR="$(dirname "$GENLAYER_BIN")/.."
GENLAYER_DIR="$(readlink -f "$GENLAYER_DIR")"
[ -f "$GENLAYER_DIR/docker-compose.yml" ] || { echo "cannot locate genlayer compose in $GENLAYER_DIR" >&2; exit 1; }

OVERRIDE="$(pwd)/deploy/localnet-migration.override.yml"

# WHY PIN THE VERSION: without this, every GenLayer image floats on `:latest`
# except webdriver, which the compose file pins to 0.0.3. `latest` has since
# moved ahead of it, so jsonrpc asks the GenVM session for a field the pinned
# webdriver does not send, and the localnet dies in a restart loop:
#
#   {"message": "Failed to start module", "module": "web",
#    "body": {"error": "missing field `session_create_request`"}, "status": 500}
#
# v0.65.0 is not a guess: it is the CLI's own compatibility constant
# (`localnetCompatibleVersion` in dist/index.js), the version `genlayer up` is
# written to work against. Override with LOCALNETVERSION=... if a newer one is
# released.
export LOCALNETVERSION="${LOCALNETVERSION:-v0.65.0}"

if ss -ltn 2>/dev/null | grep -q ':5432'; then
  echo "port 5432 is in use; the localnet needs it free." >&2
  echo "  stop it (e.g. sudo systemctl stop postgresql), then re-run." >&2
  exit 1
fi

RESET=""
[ "${1:-}" = "--reset-db" ] && RESET="--reset-db"

echo "== bringing up localnet (override: $OVERRIDE) =="
cd "$GENLAYER_DIR"
# The CLI runs exactly: docker compose build && docker compose -p genlayer
# --profile frontend up -d. Ours adds -f for the generated override plus ours.
exec docker compose \
  -f docker-compose.yml \
  -f docker-compose.override.yml \
  -f "$OVERRIDE" \
  -p genlayer \
  --profile frontend \
  up -d --build $RESET