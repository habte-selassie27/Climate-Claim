#!/usr/bin/env node
/** Full-page proof that the policy detail page contains the new panels. */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "http://127.0.0.1:4173";
const OUT = join(process.cwd(), "artifacts/screenshots");

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    const c = join(root, dir, "chrome-linux64", "chrome");
    if (existsSync(c)) return c;
  }
  return null;
}

const CHROME = findChrome();
const port = 9231;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "about:blank"]);
await new Promise((r) => setTimeout(r, 1500));
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => {
    const m = ++id;
    pending.set(m, res);
    ws.send(JSON.stringify({ id: m, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 3600, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/policies/policy-3` });
await new Promise((r) => setTimeout(r, 16000));
const probe = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    hasStartClaim: document.body.innerText.includes("Start a claim"),
    hasSourceCards: document.querySelectorAll("[data-testid=source-card]").length,
    hasDateInputs: document.querySelectorAll('input[type=date]').length,
    claimsHeading: [...document.querySelectorAll("h2")].map(h => h.textContent),
  })`,
  returnByValue: true,
});
const state = JSON.parse(probe.result.value);
console.log(JSON.stringify(state, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "n3-policy-detail-full.png"), Buffer.from(shot.data, "base64"));
console.log("saved n3-policy-detail-full.png");
const ok = state.hasStartClaim && state.hasDateInputs === 2;
console.log(ok ? "PANELS PASS" : "PANELS FAIL");
chrome.kill();
process.exit(ok ? 0 : 1);
