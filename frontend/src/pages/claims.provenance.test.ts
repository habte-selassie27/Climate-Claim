import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNAPSHOT_CONTRACT, SNAPSHOT_CAPTURED_AT } from "../services/rpc";

/**
 * The Claims page used to print the CONFIGURED contract address next to data
 * that was recorded from a DIFFERENT deployment:
 *
 *   onchain-snapshot.json -> "contract": "0xE1603242...F0c"   (v1)
 *   config/contracts.ts   -> CONTRACT_ADDRESS                  (v2, later 0x6e0853)
 *
 * So it asserted "Every claim below exists on the deployed contract at <v2>",
 * for claims that had never existed on v2. A steward checking the explorer link
 * would find an empty contract.
 *
 * This is the worst class of bug for this project specifically: ClimateClaim's
 * entire claim is that evidence carries its provenance, so a page that
 * misattributes on-chain data to the wrong contract undercuts the product.
 */

const claims = readFileSync(
  fileURLToPath(new URL("../pages/Claims.tsx", import.meta.url)),
  "utf8",
);

describe("snapshot provenance", () => {
  it("names a real address", () => {
    expect(SNAPSHOT_CONTRACT).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("records when the data was captured", () => {
    expect(SNAPSHOT_CAPTURED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("is the address the snapshot was actually read from", () => {
    const raw = JSON.parse(
      readFileSync(fileURLToPath(new URL("../data/onchain-snapshot.json", import.meta.url)), "utf8"),
    );
    expect(SNAPSHOT_CONTRACT).toBe(raw.contract);
  });

  it("differs from the configured address, which is why this was a bug", () => {
    // If these ever match, the page is correct but this test stops proving
    // anything. That is fine -- it fails loudly rather than silently passing
    // for the wrong reason.
    const configured = readFileSync(
      fileURLToPath(new URL("../config/contracts.ts", import.meta.url)),
      "utf8",
    );
    const active = /ENV_CONTRACT_ADDRESS \|\| "(0x[0-9a-fA-F]{40})"/.exec(configured)?.[1];
    expect(active).toBeTruthy();
    expect(SNAPSHOT_CONTRACT).not.toBe(active);
  });
});

describe("Claims page attribution", () => {
  it("attributes the data to the snapshot's contract, not the configured one", () => {
    expect(claims).toContain("SNAPSHOT_CONTRACT");
    expect(claims).toMatch(/claims\.lede",\s*\{\s*address:\s*SNAPSHOT_CONTRACT/);
  });

  it("does not pass the configured address to that copy", () => {
    // The regression in its exact prior form.
    expect(claims).not.toMatch(/claims\.lede",\s*\{\s*address:\s*CONTRACT_ADDRESS/);
  });
});