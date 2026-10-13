#!/usr/bin/env node
/**
 * Smoke test for the two new routes (/policies/new, /policies/:id with the
 * start-claim panel). Loads each page in headless Chromium, records console
 * errors and failed requests, and saves a screenshot as evidence.
 *
 *   node scripts/smoke-new-routes.mjs [baseUrl] [outDir]
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
  console.error("No Chromium found. Set CHROME_PATH.");
  process.exit(1);
}

const PAGES = [
  { path: "/policies/new", name: "n1-policy-new-form", wait: 3000 },
  { path: "/policies/policy-3", name: "n2-policy-detail-start-claim", wait: 15000 },
];

mkdirSync(OUT, { recursive: true });
const port = 9229;
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
]);
await new Promise((r) => setTimeout(r, 1500));

async function newTarget() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  return res.json();
}

const results = [];
let failures = 0;

for (const page of PAGES) {
  const target = await newTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((res) => {
      const msgId = ++id;
      pending.set(msgId, res);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  const consoleErrors = [];
  const failedRequests = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(msg.params.exceptionDetails.text);
    }
    if (msg.method === "Network.loadingFailed") {
      failedRequests.push(msg.params.errorText);
    }
  };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: `${BASE}${page.path}` });
  await new Promise((r) => setTimeout(r, page.wait));
  // Assert the app actually rendered: the SPA shell must contain the marker
  // text. A 404 document loads with zero console errors, so console silence
  // alone proves nothing (learned the hard way: a stale preview server
  // returned browser 404 pages that passed a console-only check).
  const probe = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      title: document.title,
      h1: document.querySelector("h1")?.textContent ?? "",
      hasApp: Boolean(document.querySelector("#root, #app")?.firstChild),
      bodyStart: document.body.innerText.slice(0, 120),
    })`,
    returnByValue: true,
  });
  const page_state = JSON.parse(probe.result.value);
  const rendered = page_state.hasApp && page_state.h1.length > 0;
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${page.name}.png`), Buffer.from(shot.data, "base64"));
  const ok = rendered && consoleErrors.length === 0;
  if (!ok) failures += 1;
  results.push({
    path: page.path,
    rendered,
    h1: page_state.h1,
    consoleErrors,
    failedRequests,
    screenshot: `${page.name}.png`,
  });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${page.path} -> ${page.name}.png (h1: ${JSON.stringify(page_state.h1)})`,
  );
  if (!rendered) console.log(`   NOT RENDERED. body: ${page_state.bodyStart}`);
  for (const e of consoleErrors) console.log(`   console.error: ${e}`);
  ws.close();
}

writeFileSync(join(OUT, "smoke-new-routes.json"), JSON.stringify(results, null, 2));
chrome.kill();
console.log(failures === 0 ? "SMOKE PASS" : `SMOKE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
