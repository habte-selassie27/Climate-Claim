#!/usr/bin/env node
// Replay the backed-up on-chain state onto the freshly deployed contracts.
//
// Nothing here is invented: every source, policy, claim and evidence row comes
// from artifacts/bradbury-backup-pre-redeploy.json, which was read off the
// previous deployment before it was superseded. Decisions are not replayed from
// the backup either — each one is re-derived with the new ClimatePolicy's
// `compute_evaluation` and recorded exactly as returned, then checked against
// what the old contract had decided.
//
// Two things this script refuses to do:
//   - trust a write's own receipt. `waitForTransactionReceipt` resolved with
//     status 5 for writes that had succeeded and the first version of this
//     script aborted on it. Every step is confirmed by reading state back
//     instead, and `start_claim` — which reads the policy cross-contract inside
//     the write, and can fail transiently under consensus — is retried until the
//     claim is readable.
//   - start over blindly. It is resumable: anything already on chain is checked
//     against the backup and skipped, so an interrupted run continues.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createClient, chains, createAccount } from "genlayer-js"

const POLICY_ADDR = "0x02b75bBd0E0398D19e0750d6adc513605AEF6DFC"
const CLAIM_ADDR = "0x0b7Cfa4012fADd9f570951bCE059bB4e2497D311"

const root = fileURLToPath(new URL("../..", import.meta.url))
const backup = JSON.parse(
  readFileSync(`${root}/artifacts/bradbury-backup-pre-redeploy.json`, "utf8"),
)
const key = readFileSync(`${root}/.env`, "utf8").match(
  /VITE_DEPLOYER_PRIVATE_KEY_BRADBURY=(0x[0-9a-fA-F]+)/,
)?.[1]
if (!key) throw new Error("VITE_DEPLOYER_PRIVATE_KEY_BRADBURY is not set in .env")

const client = createClient({ chain: chains.testnetBradbury, account: createAccount(key) })
const R = (address, functionName, args = []) =>
  client.readContract({ address, functionName, args })
const W = async (functionName, args) => {
  const hash = await client.writeContract({ address: POLICY_ADDR, functionName, args })
  await client.waitForTransactionReceipt({ hash })
  return hash
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Read state until `ok` holds, up to `tries`. Never inferred from a receipt.
const confirm = async (ok, tries = 10) => {
  for (let i = 1; i <= tries; i++) {
    if (await ok()) return true
    await sleep(5000)
  }
  return false
}

// ---- 1. sources ---------------------------------------------------------
const haveSources = (await R(POLICY_ADDR, "list_sources")).map((s) => s.id)
for (const s of backup.sources) {
  if (haveSources.includes(s.id)) {
    console.log(`source ${s.id} already present`)
    continue
  }
  try {
    await W("register_source", [
      s.id, s.name, s.kind, s.metric, s.param, s.url_template, s.unit, s.attribution,
    ])
  } catch (e) {
    console.log(`source ${s.id}: write rejected (${String(e).slice(0, 60)})`)
  }
  const ok = await confirm(async () =>
    (await R(POLICY_ADDR, "list_sources")).some((x) => x.id === s.id),
  )
  if (!ok) throw new Error(`source ${s.id} never appeared`)
  console.log(`source ${s.id} registered`)
}

// ---- 2. policies --------------------------------------------------------
// The backup's first six policies are replayed; the seventh existed only to
// compensate for a mistaken retirement, and is not restored. New ids are
// assigned in creation order, so existing[i] corresponds to backup[i].
// The backup's seventh policy was a duplicate and is deliberately not replayed.
for (const [i, p] of backup.policies.slice(0, 6).entries()) {
  const existing = (await R(POLICY_ADDR, "list_policies"))[i]
  if (existing) {
    if (existing.location_name !== p.location_name || existing.period_start !== p.period_start)
      throw new Error(`policy ${i + 1} on chain does not match the backup — refusing to continue`)
    console.log(`policy ${p.id} already present`)
    continue
  }
  // A write can fail transiently under consensus — `create_policy` for
  // Reykjavik was rejected once through genlayer-js and accepted unchanged
  // through the CLI moments later — so this retries and confirms by reading.
  let made = false
  for (let attempt = 1; attempt <= 5 && !made; attempt++) {
    try {
      await W("create_policy", [
        p.location_name, p.lat_scaled, p.lon_scaled, p.tolerance_m, p.source_ids,
        p.agreement_rule, p.min_sources, p.data_mode, p.period_start, p.period_end,
        p.timezone, p.metric, p.unit, p.comparator, p.threshold_scaled,
        p.aggregation, p.condition_text, p.payout_amount,
      ])
    } catch (e) {
      console.log(`policy ${p.id}: write rejected (${String(e).slice(0, 60)}), attempt ${attempt}`)
    }
    made = await confirm(async () =>
      (await R(POLICY_ADDR, "list_policies")).some((x) => x.id === p.id),
    )
  }
  if (!made) throw new Error(`policy ${p.id} never appeared`)
  console.log(`policy ${p.id} created (${p.data_mode}, ${p.location_name})`)
}

// ---- 3. claims ----------------------------------------------------------
for (const old of backup.claims) {
  if ((await R(CLAIM_ADDR, "list_claims")).some((c) => c.id === old.id)) {
    console.log(`${old.id} already present`)
    continue
  }
  let landed = false
  for (let attempt = 1; attempt <= 5 && !landed; attempt++) {
    try {
      const hash = await client.writeContract({
        address: CLAIM_ADDR,
        functionName: "start_claim",
        args: [old.policy_id, old.period_start, old.period_end],
      })
      await client.waitForTransactionReceipt({ hash })
    } catch (e) {
      console.log(`${old.id}: write rejected (${String(e).slice(0, 60)}), attempt ${attempt}`)
    }
    landed = await confirm(async () =>
      (await R(CLAIM_ADDR, "list_claims")).some((c) => c.id === old.id),
    )
    console.log(`${old.id}: ${landed ? "landed" : `retrying (attempt ${attempt})`}`)
  }
  if (!landed) throw new Error(`${old.id} would not land after 5 attempts`)
}

// ---- 4. decisions, re-derived -------------------------------------------
let bad = 0
for (const old of backup.claims) {
  const now = await R(CLAIM_ADDR, "get_claim", [old.id])
  if (now.state !== "created") {
    // Already decided by an earlier run: check it rather than record again.
    const same =
      now.decision === old.decision &&
      now.reason === old.reason &&
      String(now.observed_scaled) === String(old.observed_scaled)
    console.log(`${old.id}: already ${now.decision}/${now.reason}  ${same ? "match" : "DIFFERS"}`)
    if (!same) bad++
    continue
  }
  const evidenceJson = JSON.stringify(old.evidence)
  const days = (Date.parse(now.period_end) - Date.parse(now.period_start)) / 86_400_000 + 1
  const derived = await R(POLICY_ADDR, "compute_evaluation", [
    JSON.stringify(now.policy_snapshot), evidenceJson, BigInt(days),
  ])
  let recorded = false
  for (let attempt = 1; attempt <= 5 && !recorded; attempt++) {
    try {
      const hash = await client.writeContract({
        address: CLAIM_ADDR,
        functionName: "record_evaluation",
        args: [
          old.id, derived.decision, derived.reason_code,
          `Derived on chain by compute_evaluation from ${derived.sources_used.length} recorded source(s); evidence supplied by the caller.`,
          derived.observed_value_scaled, evidenceJson,
        ],
      })
      await client.waitForTransactionReceipt({ hash })
    } catch (e) {
      console.log(`${old.id}: write rejected (${String(e).slice(0, 60)}), attempt ${attempt}`)
    }
    recorded = await confirm(async () => {
      const c = await R(CLAIM_ADDR, "get_claim", [old.id])
      return c.state !== "created" && c.evidence.length > 0
    })
  }
  if (!recorded) throw new Error(`${old.id}: evaluation never landed`)
  const after = await R(CLAIM_ADDR, "get_claim", [old.id])
  const same =
    after.decision === old.decision &&
    after.reason === old.reason &&
    String(after.observed_scaled) === String(old.observed_scaled)
  if (!same) bad++
  console.log(
    `${old.id}: ${after.decision}/${after.reason}/${String(after.observed_scaled)}` +
      `  old was ${old.decision}/${old.reason}/${String(old.observed_scaled)}  ${same ? "match" : "DIFFERS"}`,
  )
}

console.log(bad === 0 ? "\nall decisions reproduce the previous deployment" : `\n${bad} decision(s) differ`)
