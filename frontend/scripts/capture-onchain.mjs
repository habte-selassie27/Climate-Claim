#!/usr/bin/env node
/**
 * Capture the real on-chain ClimateClaim state into a committed snapshot.
 *
 * The app reads live from StudioNet first and falls back to this snapshot when
 * the RPC is unreachable, so a reviewer always sees real data. The snapshot is
 * generated - never hand-edited - by this script.
 *
 *   npm run capture        (from frontend/)
 *
 * Writes: src/data/onchain-snapshot.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, chains } from "genlayer-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/onchain-snapshot.json");

const CONTRACT = "0xE16032420e3155C0822e9150a98c6B1163869F0c";

const client = createClient({ chain: chains.studionet });

/**
 * StudioNet enforces a hard limit of 30 RPC requests per minute
 * (observed 2026-10-13, error code -32029 "Rate limit exceeded", with a
 * `retry_after_seconds` hint). A naive sequential loop blows through that,
 * because each claim needs five separate reads.
 *
 * So: space requests out and retry on the rate-limit error. The same limit is
 * the reason the app's service layer serialises and de-duplicates reads.
 */
const MIN_INTERVAL_MS = 2200; // ~27 requests/minute, safely under the cap
let lastRequest = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
}

async function readRaw(functionName, args) {
  await throttle();
  return client.readContract({
    address: CONTRACT,
    functionName,
    ...(args ? { args } : {}),
  });
}

async function read(functionName, args, attempt = 0) {
  try {
    return await readRaw(functionName, args);
  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    const hint = err?.cause?.data?.retry_after_seconds;
    const isRateLimit = code === -32029 || /rate limit/i.test(String(err?.cause?.message ?? err?.message ?? ""));
    if (isRateLimit && attempt < 6) {
      const waitMs = (typeof hint === "number" ? hint : 10) * 1000 + 1000;
      process.stdout.write(`  rate limited, waiting ${Math.round(waitMs / 1000)}s\n`);
      await sleep(waitMs);
      return read(functionName, args, attempt + 1);
    }
    throw err;
  }
}

/** Plain JS objects; the RPC may hand back bigints. */
function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

const snapshot = {
  capturedAt: new Date().toISOString(),
  network: "studionet",
  contract: CONTRACT,
  explorerNote:
    "StudioNet explorer deployment is paused, so tx links are shown disabled.",
};

snapshot.owner = await read("get_owner");
snapshot.criteriaVersion = await read("get_criteria_version");
snapshot.policyCount = await read("get_policy_count");
snapshot.claimCount = await read("get_claim_count");
snapshot.sources = jsonSafe(await read("list_sources"));
snapshot.policies = jsonSafe(await read("list_policies"));

const claimIds = [];
const total = Number(snapshot.claimCount);
for (let i = 1; i <= total; i += 1) claimIds.push(`claim-${i}`);

snapshot.claims = {};
for (const id of claimIds) {
  const claim = jsonSafe(await read("get_claim", [id]));
  if (!claim || !claim.id) continue;
  const evidence = jsonSafe(await read("get_evidence", [id]));
  const checks = jsonSafe(await read("get_checks", [id]));
  const disputes = jsonSafe(await read("get_disputes", [id]));
  const settlement = jsonSafe(await read("get_settlement", [id]));
  snapshot.claims[id] = {
    claim,
    evidence: Array.isArray(evidence) ? evidence : [],
    checks: Array.isArray(checks) ? checks : [],
    disputes: Array.isArray(disputes) ? disputes : [],
    settlement: settlement ?? null,
  };
  process.stdout.write(`captured ${id} (${claim.state})\n`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(`\nwrote ${OUT}\n`);
process.stdout.write(
  `${snapshot.policyCount} policies, ${snapshot.claimCount} claims captured at ${snapshot.capturedAt}\n`,
);