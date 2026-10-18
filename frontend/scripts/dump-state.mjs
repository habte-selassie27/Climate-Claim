// Dump every record from both deployed contracts, so a redeploy can reproduce
// the state exactly instead of being re-invented from memory.
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createClient, chains } from "genlayer-js"

const POLICY = "0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807"
const CLAIM = "0xb80eC5aEa3A62a5F282DB19bA1ccE311b642bC51"

const c = createClient({ chain: chains.testnetBradbury })

const dump = {
  taken_at: new Date().toISOString(),
  policy_contract: POLICY,
  claim_contract: CLAIM,
  sources: await c.readContract({ address: POLICY, functionName: "list_sources" }),
  policies: await c.readContract({ address: POLICY, functionName: "list_policies" }),
  claims: await c.readContract({ address: CLAIM, functionName: "list_claims" }),
}

writeFileSync(
  fileURLToPath(new URL("../../artifacts/bradbury-backup-pre-redeploy.json", import.meta.url)),
  JSON.stringify(dump, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n",
)

console.log(`sources: ${dump.sources.length}`)
console.log(`policies: ${dump.policies.length}`)
console.log(`claims: ${dump.claims.length}`)
for (const cl of dump.claims) {
  console.log(
    `  ${cl.id} -> ${cl.policy_id} ${cl.period_start}..${cl.period_end} ` +
      `${cl.state}/${cl.decision}/${cl.reason} rows=${cl.evidence.length}`,
  )
}
