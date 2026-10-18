#!/usr/bin/env bash
# Verify the CURRENT deployment against the configuration the app actually uses.
#
# Read-only: it deploys nothing, writes nothing, and changes no configuration.
# It answers one question -- do the addresses in .env / config/contracts.ts hold
# bytecode on the network the app is configured for, and do the methods the UI
# calls actually exist?
#
#   ./scripts/verify-deployment.sh
#
# Exits non-zero on any mismatch, so it is usable as a check.
set -uo pipefail

POLICY="${VITE_CLIMATEPOLICY_ADDRESS:-}"
CLAIM="${VITE_CLIMATECLAIM_ADDRESS:-}"
RPC="${VITE_GENLAYER_RPC_URL:-https://rpc-bradbury.genlayer.com}"
NETWORK="${VITE_GENLAYER_NETWORK_BRADBURY:-testnet-bradbury}"
fail=0

die() { echo "ERROR: $*" >&2; exit 1; }
ok()   { echo "  ok    $*"; }
bad()  { echo "  FAIL  $*"; fail=1; }

is_addr() { [[ "$1" =~ ^0x[0-9a-fA-F]{40}$ ]]; }
is_addr "$POLICY" || die "VITE_CLIMATEPOLICY_ADDRESS is unset or not a 0x address"
is_addr "$CLAIM"   || die "VITE_CLIMATECLAIM_ADDRESS is unset or not a 0x address"

echo "network : $NETWORK"
echo "rpc     : $RPC"
echo "policy  : $POLICY"
echo "claim   : $CLAIM"
echo

rpc() { curl -s -m 30 -X POST "$RPC" -H 'content-type: application/json' -d "$1"; }

echo "chain id"
chain=$(rpc '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -oE '0x[0-9a-f]+' | head -1)
echo "  $chain"
[[ -n "$chain" ]] && ok "reachable" || bad "no chain id"

echo
echo "bytecode present (a contract with no code is not deployed)"
for pair in "policy:$POLICY" "claim:$CLAIM"; do
  name="${pair%%:*}"; addr="${pair##*:}"
  code=$(rpc "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"$addr\",\"latest\"]}" | grep -oE '"result":"0x[0-9a-f]*"' | cut -d'"' -f4)
  if [[ -n "$code" && "$code" != "0x" ]]; then
    ok "$name has bytecode ($(( (${#code} - 2) / 2 )) bytes)"
  else
    bad "$name has NO bytecode at $addr on $NETWORK"
  fi
done

echo
echo "methods the UI calls actually answer"
genlayer network set "$NETWORK" >/dev/null 2>&1
probe() { # name address method [arg]
  if [[ -n "${4:-}" ]]; then out=$(genlayer call "$2" "$3" --args "$4" 2>&1);
  else out=$(genlayer call "$2" "$3" 2>&1); fi
  if grep -q "Read operation successfully executed" <<<"$out"; then
    ok "$3"
  else
    bad "$3 -> $(grep -oE 'Error[^,]*|not found|__handle_undefined_method__' <<<"$out" | head -1)"
  fi
}
probe policy "$POLICY" list_sources
probe policy "$POLICY" list_policies
probe claim  "$CLAIM"  list_claims
probe claim  "$CLAIM"  get_claim_count
probe claim  "$CLAIM"  get_escrow_balance

# get_policy needs an id, so probe it against whatever the first policy is.
pid=$(genlayer call "$POLICY" list_policies 2>/dev/null | grep -oE "id: '[^']+'" | head -1 | cut -d"'" -f2)
if [[ -n "$pid" ]]; then probe policy "$POLICY" get_policy "$pid"; else ok "get_policy (no policy yet)"; fi

echo
echo "current contents"
genlayer call "$POLICY" list_sources 2>/dev/null | grep -cE "^  \{" | xargs -I{} echo "  sources : {}"
genlayer call "$POLICY" list_policies 2>/dev/null | grep -cE "^  \{" | xargs -I{} echo "  policies: {}"
genlayer call "$CLAIM"  get_claim_count 2>/dev/null | grep -oE '^[0-9]+' | xargs -I{} echo "  claims  : {}"

echo
if [[ $fail -eq 0 ]]; then
  echo "All checks passed."
else
  echo "One or more checks FAILED." >&2
fi
exit $fail