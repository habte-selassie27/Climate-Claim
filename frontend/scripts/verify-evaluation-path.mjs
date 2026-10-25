#!/usr/bin/env node
// Prove the full claim path on Bradbury against the deployed contracts:
// create a policy that pays out -> fund the claim escrow -> open a claim ->
// evaluate it from the real sources (consensus round) -> sync the stored result
// into the claim -> finalize -> settle -> confirm.
//
// Every step reads the contract back and prints what it actually contains. If a
// write reverts, the script stops; it never invents a decision or a tx hash.
//
// Usage: node frontend/scripts/verify-evaluation-path.mjs
// Requires VITE_DEPLOYER_PRIVATE_KEY_BRADBURY in the repository-root .env.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, chains, createAccount } from "genlayer-js";
import { CalldataAddress } from "genlayer-js/types";

const POLICY = process.env.POLICY ?? "0x02b75bBd0E0398D19e0750d6adc513605AEF6DFC";
const CLAIM = process.env.CLAIM ?? "0xF02dB07A78f40E685c442D563F5C383C83104102";
const EVALUATOR = process.env.EVALUATOR ?? "0xA6A70e94fd382459adeB3557de33784ed40d5eB6";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const key = readFileSync(`${repoRoot}.env`, "utf8").match(
  /VITE_DEPLOYER_PRIVATE_KEY_BRADBURY=(0x[0-9a-fA-F]+)/,
)?.[1];
if (!key) {
  console.error("VITE_DEPLOYER_PRIVATE_KEY_BRADBURY is not set in the repository-root .env");
  process.exit(2);
}
const client = createClient({ chain: chains.testnetBradbury, account: createAccount(key) });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// genlayer-js encodes a plain string as a string; an `Address` parameter needs
// the SDK's own calldata type or the contract receives the wrong type.
const toAddr = (hex) => new CalldataAddress(
  Uint8Array.from(hex.replace(/^0x/, "").match(/../g).map((h) => parseInt(h, 16))),
);

async function submit(label, address, functionName, args = [], value = 0n) {
  let hash;
  for (let attempt = 1; attempt <= 3 && !hash; attempt++) {
    try {
      hash = await client.writeContract({ address, functionName, args, value });
    } catch (err) {
      // Bradbury rejects a submission at the EVM layer occasionally before any
      // consensus message exists. Retrying a submission is safe; the contract
      // still enforces duplicate rules.
      console.log(`${label}: submission attempt ${attempt} reverted (${String(err.message).slice(0, 90)}…)`);
      if (attempt === 3) throw err;
      await sleep(4000);
    }
  }
  const receipt = await client.waitForTransactionReceipt({ hash, interval: 2000, retries: 200 });
  const status = receipt.status_name ?? receipt.statusName;
  const exec = receipt.txExecutionResultName ?? receipt.txExecutionResult;
  console.log(`${label}: ${hash} ${status} ${exec}`);
  if (exec === "FINISHED_WITH_ERROR") throw new Error(`${label} executed with an error: ${hash}`);
  return hash;
}

const read = (address, functionName, args = []) =>
  client.readContract({ address, functionName, args });

// A write is visible to reads once it is decided, but a read issued immediately
// after the receipt can still hit the previous state. Poll rather than race.
async function readUntil(fn, accept, label, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const value = await fn();
    if (accept(value)) return value;
    await sleep(2000);
  }
  throw new Error(`${label}: state did not settle`);
}

const existing = process.env.POLICY_ID;
let beforePolicy = "";
if (existing) {
  console.log(`reusing policy ${existing}`);
} else {
  const policies = await read(POLICY, "list_policies");
  beforePolicy = policies.at(-1)?.id ?? "";
  console.log(`policies before: ${policies.length}`);
  await submit("create_policy", POLICY, "create_policy", [
    "Paris, France", 48850000, 2350000, 25000,
    ["om_archive_precip", "nasa_power_precip"], "unanimous", 2,
    "historical_simulation", "2024-06-01", "2024-06-05", "UTC",
    "precipitation", "mm", "gt", 100, "max_single",
    "Any single day above 1.00 mm.", 10000000000000000n,
  ]);
}
const policy = existing
  ? await read(POLICY, "get_policy", [existing])
  : await readUntil(async () => (await read(POLICY, "list_policies")).at(-1),
      (p) => p && p.id !== beforePolicy, "create_policy");
console.log(`policy: ${policy.id} v${policy.version} payout=${policy.payout_amount} ${policy.period_start}..${policy.period_end}`);

await submit("fund", CLAIM, "fund", [], 20000000000000000n);
console.log(`escrow: ${await read(CLAIM, "get_escrow_balance")}`);

const claimsBefore = await read(CLAIM, "get_claim_count");
await submit("start_claim", CLAIM, "start_claim", [policy.id, "2024-06-01", "2024-06-05"]);
const claims = await readUntil(() => read(CLAIM, "list_claims"),
  (list) => list.length === claimsBefore + 1, "start_claim");
const claim = claims.at(-1);
console.log(`claim: ${claim.id} state=${claim.state} policy=${claim.policy_id}`);

await submit("evaluate_for_claim", EVALUATOR, "evaluate_for_claim", [toAddr(CLAIM), claim.id]);
const result = await readUntil(() => read(EVALUATOR, "get_result", [claim.id, claim.dispute_rounds]),
  (r) => r && r.decision, "evaluate_for_claim");
console.log(`consensus result: ${result.decision} / ${result.reason_code} / observed=${result.observed_value_scaled} / round=${result.round}`);
for (const s of result.sources ?? []) {
  console.log(`  ${s.source_id}: ok=${s.ok} value=${s.value_scaled} days=${s.days_covered} unit=${s.unit} station=${s.station} error=${s.error || "-"}`);
}

await submit("sync_evaluation", CLAIM, "sync_evaluation", [claim.id]);
const decided = await readUntil(() => read(CLAIM, "get_claim", [claim.id]),
  (c) => c.evaluation_round > 0, "sync_evaluation");
console.log(`claim after sync: state=${decided.state} decision=${decided.decision} reason=${decided.reason} observed=${decided.observed_scaled} evidence_rows=${decided.evidence.length}`);

if (decided.decision !== "confirmed") {
  console.log("not a confirmed claim; settlement is not applicable");
  process.exit(0);
}

await submit("finalize_decision", CLAIM, "finalize_decision", [claim.id]);
await readUntil(() => read(CLAIM, "get_claim", [claim.id]), (c) => c.finalized, "finalize_decision");
await submit("settle_claim", CLAIM, "settle_claim", [claim.id]);
const settling = await readUntil(() => read(CLAIM, "get_claim", [claim.id]),
  (c) => c.settlement_state !== "not_settled", "settle_claim");
console.log(`settlement: ${settling.settlement_state} payouts=${JSON.stringify(settling.payouts)} in_flight=${JSON.stringify(await read(CLAIM, "get_in_flight"))}`);

await submit("confirm_settlement", CLAIM, "confirm_settlement", [claim.id, "verify-evaluation-path"]);
const settled = await readUntil(() => read(CLAIM, "get_claim", [claim.id]),
  (c) => c.settlement_state === "settled", "confirm_settlement");
console.log(`final: state=${settled.state} settlement=${settled.settlement_state} payouts=${JSON.stringify(settled.payouts)}`);
console.log(`escrow ledger: ${await read(CLAIM, "get_escrow_balance")}`);
