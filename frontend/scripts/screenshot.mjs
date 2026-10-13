#!/usr/bin/env node
/**
 * Capture screenshots of the built app for the evidence pack.
 *
 * Drives headless Chromium over the DevTools Protocol. No extra npm dependency
 * is required: it uses the Playwright-managed Chromium that is already on this
 * machine (see ~/.cache/ms-playwright).
 *
 *   node scripts/screenshot.mjs [baseUrl] [outDir]
 *
 * Note: vite preview does not rewrite deep links by default, so each path is
 * requested directly. `vite preview` does serve index.html for unknown paths,
 * which is what makes the SPA routes work here.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const OUT = resolve(process.argv[3] ?? resolve(HERE, "../../artifacts/screenshots"));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(process.env.HOME ?? "", ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    const candidate = join(root, dir, "chrome-linux64", "chrome");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const CHROME = findChrome();
if (!CHROME) {
  console.error("No Chromium found. Set CHROME_PATH to a Chrome/Chromium binary.");
  process.exit(1);
}

const PAGES = [
  // The landing page was captured before React finished its first paint on a cold
  // cache, producing a blank h1. Give it a settle window like the rest.
  { path: "/", name: "01-landing", full: true, wait: 2500 },
  { path: "/demo?scenario=conflicting-sources", name: "02-demo-source-conflict", full: true, wait: 2500 },
  { path: "/demo?scenario=location-mismatch", name: "03-demo-location-mismatch", full: true, wait: 9000 },
  { path: "/demo?scenario=missing-observations", name: "04-demo-missing-observations", full: true, wait: 2500 },
  { path: "/demo?scenario=repeated-attempt", name: "05-demo-repeated-attempt", full: true, wait: 2500 },
  { path: "/claims", name: "06-claims-table", full: true, wait: 15000 },
  { path: "/claims/claim-2", name: "07-claim-2-confirmed", full: true, wait: 15000 },
  { path: "/claims/claim-4", name: "08-claim-4-inconclusive-location", full: true, wait: 15000 },
  { path: "/claims/claim-5", name: "09-claim-5-not-confirmed", full: true, wait: 15000 },
  { path: "/claims/claim-1", name: "10-claim-1-external-error", full: true, wait: 15000 },
  { path: "/policies", name: "11-policies", full: true, wait: 10000 },
  { path: "/policies/policy-3", name: "12-policy-3-detail-start-claim", full: true, wait: 15000 },
  { path: "/how-it-works", name: "13-how-it-works", full: true },
  { path: "/policies/new", name: "14-policy-new-form", full: true, wait: 10000 },
  {
    path: "/claims/claim-5",
    name: "15-dispute-form-open",
    full: true,
    wait: 15000,
    // Open the dispute form by clicking its toggle, then fill grounds, so the
    // screenshot shows the real interactive state rather than the closed one.
    async click(selector) {
      const el = document.querySelector(selector);
      if (el) el.click();
    },
    clickSelector: "button.btn-secondary",
  },
  { path: "/claims/claim-2", name: "16-claim-2-mobile-360", full: true, width: 360, height: 900, wait: 15000 },
];

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version");
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chromium DevTools endpoint never came up");
}

const wsUrl = await endpoint();
const { WebSocket } = await import("ws").catch(() => ({ WebSocket: globalThis.WebSocket }));
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}, sessionId) {
  msgId += 1;
  const id = msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);

const results = [];

for (const page of PAGES) {
  const width = page.width ?? 1280;
  const height = page.height ?? 900;
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 1, mobile: width < 500 },
    sessionId,
  );
  await send("Page.navigate", { url: `${BASE}${page.path}` }, sessionId);
  await sleep(page.wait ?? 1200);

  // Optional interaction step, evaluated in the page after it settles.
  if (page.clickSelector) {
    await send(
      "Runtime.evaluate",
      { expression: `(() => { const el = document.querySelector(${JSON.stringify(page.clickSelector)}); if (el) { el.click(); return true; } return false; })()`, returnByValue: true },
      sessionId,
    );
    await sleep(900);
    // Fill the grounds textarea so the screenshot shows a realistic state.
    await send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const ta = document.querySelector('#dispute-grounds');
          if (!ta) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(ta, 'NASA POWER reports 3.79 mm for 2024-06-01, which is above the 5.00 mm threshold when taken with the unit it publishes (mm/day rather than mm). The validator appears to have compared the two sources without reconciling their units.');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`,
        returnByValue: true,
      },
      sessionId,
    );
    await sleep(400);
  }

  const { result } = await send(
    "Runtime.evaluate",
    {
      expression: `JSON.stringify({
        title: document.title,
        h1: document.querySelector('h1')?.textContent ?? null,
        origin: document.querySelector('[data-testid="origin-badge"]')?.textContent ?? null,
        finality: document.querySelector('[data-testid="finality-chip"]')?.textContent ?? null,
        decision: document.querySelector('.decision-label')?.textContent ?? null,
        summary: document.querySelector('[data-testid="chart-summary"]')?.textContent ?? null,
        checks: document.querySelectorAll('[data-testid="checklist"] li').length,
        evidenceRows: document.querySelectorAll('[data-testid="evidence-table"] tbody tr').length,
        claimRows: document.querySelectorAll('[data-testid="claims-table"] tbody tr').length,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      })`,
      returnByValue: true,
    },
    sessionId,
  );

  const { data } = await send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: page.full !== false },
    sessionId,
  );

  const file = join(OUT, `${page.name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  const info = JSON.parse(result.value);
  results.push({ page: page.path, file, ...info });
  console.log(`${page.path} -> ${page.name}.png  ${info.h1 ?? ""}`);
}

writeFileSync(join(OUT, "screenshot-report.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nwrote ${results.length} screenshots to ${OUT}`);

await send("Target.closeTarget", { targetId });
ws.close();
chrome.kill();
process.exit(0);