import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Regression pin for the "No account set" failure and the status-refresh wiring.
 *
 * `client.writeContract` threw "No account set. Configure the client with an
 * account or pass an account to this function." because the write path used the
 * accountless read client. The fix wires the connected wallet's account AND its
 * own EIP-6963 provider into a separate signing client, and pairs the status
 * panel's refresh button with a real transaction re-check (`refreshTx`).
 *
 * These read the sources structurally, like the other contract-pinning tests in
 * this repo, because the behaviour they protect is a wiring decision that only
 * shows up against a live wallet.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("write path carries a signer", () => {
  const evalSrc = read("./evaluationService.ts");
  const clientSrc = read("./client.ts");

  it("runWrite reads the signer from the shared wallet store", () => {
    expect(evalSrc).toContain("currentSigner()");
  });

  it("runWrite signs with the connected account and its provider", () => {
    expect(evalSrc).toMatch(
      /const client = await getWriteClient\(signer\.account, signer\.provider\)/,
    );
  });

  it("runWrite fails fast when no account is connected", () => {
    // A signed write without an account is exactly the bug this pins; the gate
    // must fire before any SDK call.
    const gateAt = evalSrc.indexOf("currentSigner()");
    const writeAt = evalSrc.indexOf("getWriteClient(");
    expect(gateAt).toBeGreaterThan(-1);
    expect(writeAt).toBeGreaterThan(gateAt);
  });

  it("getWriteClient configures both the account and the provider", () => {
    expect(clientSrc).toMatch(/export function getWriteClient/);
    expect(clientSrc).toMatch(/account: account as/);
    expect(clientSrc).toMatch(/provider: provider as/);
  });

  it("the signing client is recreated when the account or provider changes", () => {
    // Caching across an account switch would sign with the previous account.
    expect(clientSrc).toMatch(/signing\.account\.toLowerCase\(\) === account\.toLowerCase\(\)/);
    expect(clientSrc).toMatch(/signing\.provider === provider/);
  });

  it("refreshTx re-reads transaction status through the signerless client", () => {
    // The refresh is a read: it must not require a wallet, and it must map
    // through the same phase mapping as the write path.
    const at = evalSrc.indexOf("export async function refreshTx");
    expect(at).toBeGreaterThan(-1);
    const body = evalSrc.slice(at);
    expect(body).toMatch(/const client = await getClient\(\)/);
    expect(body).toMatch(/phaseForStatus\(/);
    // Forward-only: a missing or empty record leaves the state untouched, and
    // phases only advance. A transaction that consensus accepted but whose call
    // failed on chain (FINISHED_WITH_ERROR) is surfaced as `failed`, never as
    // "accepted".
    expect(body).toMatch(/statusName === "UNINITIALIZED"\) return current/);
    expect(body).toMatch(/executionFailed\(tx\)/);
    expect(body).toMatch(/nextPhase\(current\.phase, phaseForStatus\(statusName\)\)/);
  });
});

describe("status panel wiring", () => {
  it("pairs the refresh button with a real transaction re-check", () => {
    // Every page that renders TxStatusPanel must let the button refresh the
    // WRITE, not only the page's reads — otherwise an accepted result can
    // never visibly reach finalized without a reload.
    for (const rel of [
      "../pages/PolicyNew.tsx",
      "../pages/ClaimDetail.tsx",
      "../components/StartClaimPanel.tsx",
    ]) {
      expect(read(rel), rel).toContain("refreshTx(tx).then(setTx)");
    }
  });

  it("links the hash through the verified explorer route", () => {
    const panel = read("../components/TxStatusPanel.tsx");
    expect(panel).toContain("explorerUrl={net.explorerUrl}");
    expect(panel).toContain("txPath={net.txPath}");
  });
});
