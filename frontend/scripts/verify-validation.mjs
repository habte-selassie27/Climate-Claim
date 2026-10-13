#!/usr/bin/env node
/**
 * Interaction test: the create-policy form's client-side validation mirror.
 *
 * Headless Chromium has no wallet, and the submit button is disabled without
 * one, so a minimal window.ethereum stub is injected before load (chain
 * 0xf22f = 61999 studionet). The form is submitted empty; the test asserts
 * that the contract's validation rules surface as field errors. No write is
 * ever attempted: the stub has no writeContract, and validation stops submit
 * before runWrite is reached.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
const port = 9233;
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
// Stub wallet: the contract owner's address, on studionet. No writeContract —
// this test must never reach the write path.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.ethereum = {
    request: async ({ method }) => {
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_requestAccounts") return ["0x5B3661C576c7001e6d6279C67F3779705d334c89"];
      throw new Error("stub: " + method);
    },
  };`,
});
await send("Page.navigate", { url: "http://127.0.0.1:4173/policies/new" });
await new Promise((r) => setTimeout(r, 3500));

// Submit the empty form.
const clicked = await send("Runtime.evaluate", {
  expression: `(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Create policy");
    if (!btn) return "no-button";
    if (btn.disabled) return "button-disabled";
    btn.click();
    return "clicked";
  })()`,
  returnByValue: true,
});
console.log("submit:", clicked.result.value);
await new Promise((r) => setTimeout(r, 600));

const probe = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    fieldErrors: [...document.querySelectorAll(".field-error")].map(e => e.textContent.trim()),
  })`,
  returnByValue: true,
});
const state = JSON.parse(probe.result.value);
console.log(JSON.stringify(state, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "n4-policy-new-validation.png"), Buffer.from(shot.data, "base64"));
console.log("saved n4-policy-new-validation.png");

// Every contract rule mirrored in the form must fire on an empty submit.
// Fields that are empty or invalid on a pristine form. Fields with valid
// defaults (tolerance 10000, timezone UTC, payout 0) or auto-fill
// (condition_text follows the summary sentence) do not error here.
const expected = ["location name", "Latitude", "Longitude", "at least one source", "Minimum agreeing", "valid calendar dates", "threshold"];
const missing = expected.filter((needle) => !state.fieldErrors.some((e) => e.toLowerCase().includes(needle.toLowerCase())));
const ok = clicked.result.value === "clicked" && missing.length === 0;
if (missing.length) console.log("missing expected errors:", missing);
console.log(ok ? "VALIDATION PASS" : "VALIDATION FAIL");
chrome.kill();
process.exit(ok ? 0 : 1);
