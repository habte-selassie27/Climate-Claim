#!/usr/bin/env bash
# Register the documented weather sources on a deployed ClimateClaim contract.
#
# The contract seeds nothing: its source registry starts empty and holds only
# what an owner registers here. This reads the catalogue at docs/sources.json
# and issues one register_source write per entry, which is the same path the
# direct tests use.
#
#   ./scripts/seed-sources.sh <contract-address>
#
# WRITES TO THE CHAIN. Read this before running: it sends real transactions.
# register_source is owner-only, so the deploying account must be the owner.
# StudioNet is gasless, so this costs nothing, but consensus still takes a few
# minutes for five sequential writes.
set -euo pipefail
cd "$(dirname "$0")/.."

A="${1:?usage: seed-sources.sh <contract-address>}"
CATALOGUE="${2:-docs/sources.json}"
OUT="artifacts/seed-sources"
mkdir -p "$OUT"

# register_source is owner-only and CLI writes sign with the active account:
# make sure the owner's account is the one signing (local, no RPC).
./scripts/select-owner-account.sh || exit 1

if [ ! -f "$CATALOGUE" ]; then
  echo "catalogue not found: $CATALOGUE" >&2
  exit 1
fi

echo "Seeding sources into $A from $CATALOGUE"

# Emit one line per source, fields separated by US (0x1f). No shell quoting is
# applied here: the fields are read back into separate variables and each is
# passed as its own quoted argument, so values containing spaces, braces or
# slashes survive intact. Quoting them at this stage would make the quotes
# literal parts of the value.
python3 - "$CATALOGUE" <<'PY' > "$OUT/sources.args"
import json, sys
SEP = "\x1f"
data = json.load(open(sys.argv[1]))
for s in data["sources"]:
    fields = [s["id"], s["name"], s["kind"], s["metric"], s["param"],
              s["url_template"], s["unit"], s["attribution"]]
    assert all(SEP not in f for f in fields), "a field contains the delimiter"
    print(SEP.join(fields))
PY

i=0
while IFS=$'\x1f' read -r sid sname skind smetric sparam surl sunit sattrib; do
  i=$((i + 1))
  # Already registered? register_source replaces, but skip to save a tx.
  existing=$(genlayer call "$A" get_source --args "$sid" 2>/dev/null | grep -c "id: '$sid'" || true)
  if [ "$existing" != "0" ]; then
    echo "  [$i] $sid already registered - skipping"
    continue
  fi

  echo "  [$i] registering $sid"
  genlayer write "$A" register_source \
    --args "$sid" "$sname" "$skind" "$smetric" "$sparam" "$surl" "$sunit" "$sattrib" \
    > "$OUT/register-$(printf '%02d' "$i")-$sid.txt" 2>&1

  hash=$(grep -oE "0x[0-9a-fA-F]{64}" "$OUT/register-$(printf '%02d' "$i")-$sid.txt" | head -1 || true)
  echo "      tx ${hash:-unknown}"
done < "$OUT/sources.args"

echo
echo "Verifying..."
genlayer call "$A" list_sources > "$OUT/list-sources-after.txt" 2>&1
count=$(grep -cE "^    id: '" "$OUT/list-sources-after.txt" || true)
echo "registry now holds $count source(s) (expected $(grep -c '"id"' "$CATALOGUE"))"
echo "Readback: $OUT/list-sources-after.txt"