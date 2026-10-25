import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { CONTRACT_ADDRESS, POLICY_ADDRESS, DEPLOYER_ADDRESS } from "../config/contracts";

/**
 * Guards against the stale-deployment data being reintroduced.
 *
 * WHAT HAPPENED: the app carried a committed snapshot
 * (src/data/onchain-snapshot.json) holding 6 policies and 5 claims read from a
 * contract that is no longer deployed — 0xE16032420e3155C0822e9150a98c6B1163869F0c
 * on StudioNet. It was a silent fallback: whenever the RPC failed, those records
 * rendered as if they belonged to the current deployment. The demo page also
 * defaulted to a hardcoded claim-2 from that same retired contract.
 *
 * This is the worst class of bug for this project specifically. ClimateClaim's
 * entire claim is that evidence carries its provenance, so a page that
 * misattributes on-chain data to the wrong contract undercuts the product.
 *
 * The snapshot has been deleted rather than repointed, because there is no
 * honest thing to repoint it to: the current deployment starts with zero claims,
 * and an empty state is correct while a fabricated list is not.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function sourceFiles(dir = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|json)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** The retired deployment's contract address. Must appear nowhere as data. */
const RETIRED_CONTRACT = "0xE16032420e3155C0822e9150a98c6B1163869F0c";

/**
 * Strip comments before scanning.
 *
 * Several files explain in prose why these addresses went away, and naming them
 * there is the point of the comment. What must not survive is an address used
 * as a VALUE, so the check runs against code with comments and string-only
 * history removed.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the recorded snapshot is gone", () => {
  it("the snapshot file does not exist", () => {
    expect(existsSync(join(SRC, "data", "onchain-snapshot.json"))).toBe(false);
  });

  it("the read path imports no snapshot data", () => {
    const rpc = code(read("services/rpc.ts"));
    expect(rpc).not.toMatch(/onchain-snapshot/);
    expect(rpc).not.toMatch(/snapshotData/);
  });

  it("the read path has no 'snapshot' origin left", () => {
    // A silent fallback needs a third origin. Only live and error remain, so a
    // read that fails cannot render recorded rows.
    const rpc = read("services/rpc.ts");
    expect(rpc).toContain('export type DataOrigin = "live" | "error"');
    expect(rpc).not.toMatch(/origin:\s*"snapshot"/);
  });

  it("the service layer exposes no snapshot seed helpers", () => {
    const svc = read("services/claimService.ts");
    for (const name of [
      "snapshotClaims",
      "snapshotPolicies",
      "snapshotSources",
      "snapshotOwner",
      "snapshotClaimBundle",
    ]) {
      expect(svc).not.toContain(name);
    }
  });

  it("no page passes a snapshot seed into useRead", () => {
    for (const file of sourceFiles(join(SRC, "pages"))) {
      expect(code(readFileSync(file, "utf8"))).not.toMatch(
        /useRead\([^)]*snapshot[A-Za-z]*(Claims|Policies|Sources|Owner|Bundle)/,
      );
    }
  });
});

describe("no retired-deployment data is referenced", () => {
  it("no source file uses the retired contract address as data", () => {
    for (const file of sourceFiles()) {
      if (file.endsWith("staleData.test.ts")) continue; // this file names it
      expect(code(readFileSync(file, "utf8"))).not.toContain(RETIRED_CONTRACT);
    }
  });

  it("no source file names the superseded Bradbury addresses", () => {
    // The two contracts deployed before the current pair. Both are real
    // deployments, but neither is the app's data source any more.
    const superseded = [
      "0xa2D82Db4ddC567199113962BFd477f069510331D",
      "0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631",
    ];
    for (const file of sourceFiles()) {
      if (file.endsWith("staleData.test.ts")) continue; // this file names them
      const src = code(readFileSync(file, "utf8"));
      for (const addr of superseded) {
        expect(src).not.toContain(addr);
      }
    }
  });

  it("the demo scenarios carry no on-chain claim ids", () => {
    // These linked to claim-2, claim-4 and claim-5 on the retired contract.
    const scenarios = code(read("fixtures/demoScenarios.ts"));
    expect(scenarios).not.toContain("onChainClaimId");
    expect(scenarios).not.toMatch(/"on_chain"/);
  });

  it("the demo scenarios describe themselves as replays", () => {
    const scenarios = read("fixtures/demoScenarios.ts");
    expect(scenarios).toContain("recorded_source_data");
    expect(scenarios).toMatch(/EVERY SCENARIO HERE IS A REPLAY/);
  });

  it("no page hardcodes a specific claim id", () => {
    for (const file of sourceFiles(join(SRC, "pages"))) {
      expect(code(readFileSync(file, "utf8"))).not.toMatch(/["'`]\s*claim-\d+\s*["'`]/);
    }
  });
});

describe("the configured deployment is the current one", () => {
  it("the claim contract is the deployed ClimateClaim", async () => {
    const { CONTRACT_ADDRESS: addr } = await import(
      pathToFileURL(join(SRC, "config", "contracts.ts")).href
    );
    // Deployed on Bradbury; see config/contracts.ts for details.
    expect(addr).toBe("0xD66064816966119D82B10A2c0735DB85219d6448");
  });

  it("the policy contract is the deployed ClimatePolicy", () => {
    expect(POLICY_ADDRESS).toBe("0xbad7E387Dbb7DE7470447041BC02147FFb0d899A");
  });

  it("both are 0x-prefixed 40-hex addresses", () => {
    for (const addr of [CONTRACT_ADDRESS, POLICY_ADDRESS, DEPLOYER_ADDRESS]) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("the claim address is not the policy address", () => {
    expect(CONTRACT_ADDRESS.toLowerCase()).not.toBe(POLICY_ADDRESS.toLowerCase());
  });
});