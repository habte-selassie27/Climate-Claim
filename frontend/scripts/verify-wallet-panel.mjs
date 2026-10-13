#!/usr/bin/env node
/**
 * Verify the wallet panel against stubbed EIP-6963 providers.
 *
 * Headless Chromium has no wallet, so two fake providers are injected before
 * load. Each announces itself on `eip6963:requestProvider` exactly as the EIP
 * specifies, which is what the app listens for. No real wallet is touched and
 * no transaction is ever sent: the stub has no write methods.
 *
 * Asserts:
 *   1. discovery finds both wallets (EIP-6963 wins over window.ethereum)
 *   2. the panel opens and lists them with icons and rdns
 *   3. selecting one marks it selected
 *   4. connect returns an address and shows the account block
 *   5. copy + disconnect buttons exist
 *   6. a wrong-network wallet surfaces the switch action
 *
 * Run with the preview server up:  npm run preview -- --port 4173
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const OUT = join(process.cwd(), "..", "artifacts", "screenshots");
const PORT = 9235;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  for (const d of readdirSync(root)) {
    const c = join(root, d, "chrome-linux64", "chrome");
    if (existsSync(c)) return c;
  }
  return null;
}

const CHROME = findChrome();
if (!CHROME) {
  console.error("No Chromium found.");
  process.exit(1);
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
await new Promise((r) => setTimeout(r, 1500));

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const m = ++id;
    pending.set(m, (v) => (v.error ? rej(new Error(`${method}: ${v.error.message}`)) : res(v.result)));
    ws.send(JSON.stringify({ id: m, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");
// Realistic desktop size. Headless Chrome defaults to 800x600, which wraps the
// header and gives a misleading picture of the layout.
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1100,
  deviceScaleFactor: 1,
  mobile: false,
});

// Two EIP-6963 wallets plus a legacy window.ethereum that must be ignored
// in favour of the announced ones.
const svgIcon = (bg) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${bg}"/><circle cx="48" cy="48" r="24" fill="#fff"/></svg>`,
  )}`;

const stub = `
  const ICONS = ${JSON.stringify({
    metamask: svgIcon("#F5841B"),
    rabby: svgIcon("#8697FF"),
  })};
  const makeWallet = (uuid, name, rdns, icon, chainId, address) => {
    const provider = {
      isMetaMask: name === "Rabby",
      request: async ({ method }) => {
        if (method === "eth_chainId") return chainId;
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
        if (method === "wallet_switchEthereumChain") return null;
        if (method === "wallet_revokePermissions") return null;
        throw new Error("unsupported: " + method);
      },
      on() {}, removeListener() {},
    };
    const info = Object.freeze({ uuid, name, rdns, icon });
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info, provider }),
    }));
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  };
  makeWallet("11111111-1111-4111-8111-111111111111", "MetaMask", "io.metamask", ICONS.metamask, "0x1a4", "0x1111111111111111111111111111111111111111");
  makeWallet("22222222-2222-4222-8222-222222222222", "Rabby", "io.rabby", ICONS.rabby, "0xf22f", "0x5B3661C576c7001e6d6279C67F3779705d334c89");
  // Legacy injection that must NOT win over the announced providers.
  window.ethereum = { isMetaMask: false, request: async () => { throw new Error("legacy"); }, on() {}, removeListener() {} };
`;

await send("Page.addScriptToEvaluateOnNewDocument", { source: stub });

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

await send("Page.navigate", { url: `${BASE}/claims/claim-2` });
await new Promise((r) => setTimeout(r, 9000));

// 1. Discovery
const discovery = await evaluate(`(() => {
  const btn = document.querySelector('.wallet-trigger');
  return { present: !!btn, label: btn?.textContent?.trim() ?? '', disabled: btn?.disabled ?? true };
})()`);
check("wallet trigger renders in header", discovery.present, discovery.label);

await evaluate(`document.querySelector('.wallet-trigger')?.click()`);
await new Promise((r) => setTimeout(r, 600));

const panel = await evaluate(`(() => {
  const opts = [...document.querySelectorAll('.wallet-option')];
  return {
    sheetOpen: !!document.querySelector('.wallet-sheet'),
    options: opts.map(o => {
      const img = o.querySelector('img.wallet-icon');
      return {
        name: o.querySelector('.wallet-option-name')?.textContent ?? '',
        rdns: o.querySelector('.wallet-option-rdns')?.textContent ?? '',
        hasImg: !!img,
        imgIsImgTag: img?.tagName === 'IMG',
        iconLoaded: !!img && img.complete && img.naturalWidth > 0,
      };
    }),
  };
})()`);

check("panel opens", panel.sheetOpen);
check(
  "discovers 2 EIP-6963 wallets",
  panel.options.length === 2,
  panel.options.map((o) => o.name).join(", "),
);
check(
  "legacy window.ethereum did not win",
  !panel.options.some((o) => o.name.includes("legacy")),
);
check(
  "icons render via <img> (SVG XSS safe)",
  panel.options.length > 0 && panel.options.every((o) => o.hasImg && o.imgIsImgTag),
);
check(
  "wallet icons actually load",
  panel.options.length > 0 && panel.options.every((o) => o.iconLoaded),
  panel.options.map((o) => `${o.name}:${o.iconLoaded}`).join(" "),
);
check(
  "rdns shown for each wallet",
  panel.options.every((o) => /io\./.test(o.rdns)),
);

// 2. Select the wrong-network wallet and connect
await evaluate(`(() => {
  const opts = [...document.querySelectorAll('.wallet-option')];
  const target = opts.find(o => (o.textContent||'').includes('MetaMask'));
  if (target) target.click();
})()`);
await new Promise((r) => setTimeout(r, 400));

const selected = await evaluate(`document.querySelector('.wallet-option.is-selected')?.textContent ?? ''`);
check("wallet can be selected", selected.includes("MetaMask"), selected.trim().slice(0, 40));

await evaluate(`(() => {
  const b = [...document.querySelectorAll('.wallet-sheet button')].find(x => x.textContent.trim() === 'Connect');
  if (b) b.click();
})()`);
await new Promise((r) => setTimeout(r, 900));

const connected = await evaluate(`(() => {
  const addr = document.querySelector('.wallet-address')?.textContent ?? '';
  const buttons = [...document.querySelectorAll('.wallet-sheet button')].map(b => b.textContent.trim());
  return {
    address: addr.trim(),
    buttons,
    switchVisible: buttons.some(b => b.startsWith('Switch to')),
  };
})()`);

check("connect returns an address", /^0x[0-9a-fA-F]{40}$/.test(connected.address), connected.address);
check("copy button present", connected.buttons.some((b) => b.startsWith("Copy address")));
check("disconnect button present", connected.buttons.includes("Disconnect"));
check("wrong-network wallet offers switch", connected.switchVisible);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "17-wallet-panel-connected.png"), Buffer.from(shot.data, "base64"));

// 3. Disconnect
await evaluate(`(() => {
  const b = [...document.querySelectorAll('.wallet-sheet button')].find(x => x.textContent.trim() === 'Disconnect');
  if (b) b.click();
})()`);
await new Promise((r) => setTimeout(r, 700));

const after = await evaluate(`(() => ({
  address: document.querySelector('.wallet-address')?.textContent ?? '',
  note: document.querySelector('.wallet-note')?.textContent?.trim() ?? '',
  trigger: document.querySelector('.wallet-trigger')?.textContent?.trim() ?? '',
}))()`);

check("disconnect clears the address", after.address === "", after.trigger);
check(
  "disconnect explains what actually happened",
  after.note.length > 0,
  after.note.slice(0, 70),
);

const shot2 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(join(OUT, "18-wallet-panel-disconnected.png"), Buffer.from(shot2.data, "base64"));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(failed.length === 0 ? "WALLET PANEL PASS" : `WALLET PANEL FAIL: ${failed.map(f=>f.name).join(", ")}`);

ws.close();
chrome.kill();
process.exit(failed.length === 0 ? 0 : 1);