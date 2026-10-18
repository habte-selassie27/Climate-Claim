#!/usr/bin/env node
// Derive a claim's decision ON CHAIN, then record exactly what came back.
//
// This exists because `record_evaluation` takes `evidence_json` as a STRING and
// `genlayer write --args` strips every double quote out of a string argument,
// so the CLI cannot transport it at all. Arrays pass through (which is why
// create_policy's source_ids works) but a JSON document never arrives intact.
// genlayer-js sends a real string, so it is the only path that works.
//
// It also refuses to invent a decision. `compute_evaluation` on ClimatePolicy is
// called with the claim's OWN frozen policy snapshot, and whatever it returns is
// what gets written. There is no local reimplementation of the rules in here: if
// the derivation fails, nothing is submitted.
//
// Usage:
//   node frontend/scripts/evaluate-claim.mjs <claimId> <evidenceJson> [days]
//
// Evidence rows are supplied by the caller. Nothing on chain fetches weather
// data, so provenance is the caller's claim, not something the chain verified.
//
// Requires VITE_DEPLOYER_PRIVATE_KEY_BRADBURY in the repository-root .env: the
// contract's record_evaluation is owner-only.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, chains, createAccount } from "genlayer-js";

const CLAIM_ADDR = "0xb80eC5aEa3A62a5F282DB19bA1ccE311b642bC51";
const POLICY_ADDR = "0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807";

const [claimId, evidenceJson, daysArg] = process.argv.slice(2);
if (!claimId || !evidenceJson) {
  console.error("usage: node frontend/scripts/evaluate-claim.mjs <claimId> <evidenceJson> [days]");
  process.exit(2);
}

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const key = readFileSync(`${repoRoot}.env`, "utf8").match(
  /VITE_DEPLOYER_PRIVATE_KEY_BRADBURY=(0x[0-9a-fA-F]+)/,
)?.[1];
if (!key) {
  console.error("VITE_DEPLOYER_PRIVATE_KEY_BRADBURY is not set in the repository-root .env");
  process.exit(2);
}

const client = createClient({ chain: chains.testnetBradbury, account: createAccount(key) });

const claim = await client.readContract({
  address: CLAIM_ADDR,
  functionName: "get_claim",
  args: [claimId],
});

if (claim.state !== "created") {
  console.log(`refusing: ${claimId} is in state '${claim.state}', not 'created'`);
  process.exit(0);
}

// Default to the span the claim itself covers, which is the span the frozen
// policy was evaluated over.
const days = Number(
  daysArg ??
    (Date.parse(claim.period_end) - Date.parse(claim.period_start)) / 86_400_000 + 1,
);

const derived = await client.readContract({
  address: POLICY_ADDR,
  functionName: "compute_evaluation",
  args: [JSON.stringify(claim.policy_snapshot), evidenceJson, BigInt(days)],
});

console.log(`derived: ${derived.decision} / ${derived.reason_code} / observed=${derived.observed_value_scaled}`);
for (const c of derived.checks) console.log(`  ${c.name}: ${c.status}`);

const tx = await client.writeContract({
  address: CLAIM_ADDR,
  functionName: "record_evaluation",
  args: [
    claimId,
    derived.decision,
    derived.reason_code,
    `Derived on chain by compute_evaluation from ${derived.sources_used.length} recorded source(s); evidence supplied by the caller.`,
    derived.observed_value_scaled,
    evidenceJson,
  ],
});
console.log(`recorded ${claimId}: ${String(tx)}`);
await client.waitForTransactionReceipt({ hash: tx });
console.log("confirmed");
