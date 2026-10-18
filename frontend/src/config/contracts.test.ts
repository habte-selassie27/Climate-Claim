import { describe, expect, it } from "vitest";

/**
 * The router is the part of the two-contract split that fails silently.
 *
 * A read sent to the wrong contract does not return stale data or a wrong
 * number -- it reverts, because the method does not exist there. So a bad route
 * surfaces as an empty screen with an RPC error, which is easy to misread as
 * "the chain has no data". These assertions pin the routing so that failure mode
 * has to be a deliberate change rather than a typo.
 *
 * The addresses themselves are cross-checked against `.env`,
 * `gltest.integration.config.yaml` and the typed fallbacks by
 * tests/direct/test_env_consistency.py; this file checks the wiring between them.
 */

describe("contract routing", () => {
  it("sends policy reads to the policy contract", async () => {
    const { addressFor, POLICY_ADDRESS } = await import("./contracts");
    for (const method of ["list_policies", "list_sources", "get_policy"]) {
      expect(addressFor(method), method).toBe(POLICY_ADDRESS);
    }
  });

  it("sends claim reads to the claim contract", async () => {
    const { addressFor, CONTRACT_ADDRESS } = await import("./contracts");
    for (const method of ["get_claim", "list_claims", "get_claim_count", "get_refunds"]) {
      expect(addressFor(method), method).toBe(CONTRACT_ADDRESS);
    }
  });

  it("sends policy writes to the policy contract", async () => {
    const { addressFor, POLICY_ADDRESS } = await import("./contracts");
    for (const method of ["create_policy", "register_source", "retire_policy"]) {
      expect(addressFor(method), method).toBe(POLICY_ADDRESS);
    }
  });

  it("sends claim writes to the claim contract", async () => {
    const { addressFor, CONTRACT_ADDRESS } = await import("./contracts");
    for (const method of ["start_claim", "record_evaluation", "settle_claim", "fund"]) {
      expect(addressFor(method), method).toBe(CONTRACT_ADDRESS);
    }
  });

  it("refuses a method that is in neither schema", async () => {
    const { addressFor } = await import("./contracts");
    // These were real methods on the old single-file contract. Routing one of
    // them would silently hit a contract that has never had it.
    for (const gone of ["request_evaluation", "get_checks", "get_owner", "get_settlement"]) {
      expect(() => addressFor(gone), gone).toThrow(/not in the deployed schema/);
    }
  });
});

describe("deployed addresses", () => {
  it("are both well-formed and distinct", async () => {
    const { CONTRACT_ADDRESS, POLICY_ADDRESS } = await import("./contracts");
    for (const address of [CONTRACT_ADDRESS, POLICY_ADDRESS]) {
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
    expect(CONTRACT_ADDRESS).not.toBe(POLICY_ADDRESS);
  });

  it("are not the retired StudioNet monolith", async () => {
    const { CONTRACT_ADDRESS, POLICY_ADDRESS } = await import("./contracts");
    // The 32-method single contract on StudioNet. If either address reverts to
    // it, the app is talking to a schema it no longer speaks.
    const monolith = "0x6E4BD06bD969E745546A7957d818eDaD47882ea8";
    expect(CONTRACT_ADDRESS).not.toBe(monolith);
    expect(POLICY_ADDRESS).not.toBe(monolith);
  });

  it("name the deployer that owns both", async () => {
    const { DEPLOYER_ADDRESS } = await import("./contracts");
    expect(DEPLOYER_ADDRESS).toBe("0x04e0353B7218b66D6803725ce7342E6e1225DB1b");
  });
});

describe("method table", () => {
  it("exposes METHODS keys identical to the schema entries", async () => {
    const { METHOD_META, METHODS } = await import("./contracts");
    expect(Object.keys(METHODS).sort()).toEqual(Object.keys(METHOD_META).sort());
  });

  it("maps each method name to itself", async () => {
    const { METHODS } = await import("./contracts");
    for (const [key, value] of Object.entries(METHODS)) {
      expect(value, key).toBe(key);
    }
  });

  it("marks the evaluation write as owner-mediated, not a request", async () => {
    const { METHOD_META } = await import("./contracts");
    expect(METHOD_META.record_evaluation).toBeDefined();
    expect(METHOD_META.record_evaluation.readonly).toBe(false);
    // The old public entry point is gone. If it reappears in the table, the app
    // would offer a write the chain cannot serve.
    expect("request_evaluation" in METHOD_META).toBe(false);
  });
});

describe("declared unavailability", () => {
  it("records the capabilities this deployment lacks", async () => {
    const { AVAILABILITY: availability } = await import("./contracts");
    expect(availability.get_checks).toBe("removed");
    expect(availability.get_criteria_version).toBe("removed");
    expect(availability.get_owner).toBe("removed");
    expect(availability.request_evaluation).toBe("removed");
  });

  it("records the ones the service layer reconstructs", async () => {
    const { AVAILABILITY: availability } = await import("./contracts");
    for (const derived of [
      "get_source",
      "get_policy_count",
      "find_claim",
      "get_evidence",
      "get_settlement",
    ] as const) {
      expect(availability[derived]).toBe("derived");
    }
  });

  it("does not claim a derived method is a real one", async () => {
    const { AVAILABILITY: availability, METHOD_META } = await import("./contracts");
    for (const name of Object.keys(availability)) {
      expect(name in METHOD_META, `${name} is listed as unavailable but is in the schema`).toBe(
        false,
      );
    }
  });
});

describe("active network", () => {
  it("is Bradbury, where the contracts are deployed", async () => {
    const { ACTIVE_NETWORK } = await import("./network");
    expect(ACTIVE_NETWORK).toBe("testnetBradbury");
  });

  it("does not let the env overrides rewrite the legacy StudioNet entry", async () => {
    const { NETWORKS } = await import("./network");
    // StudioNet's values are literals now. The .env overrides point at the
    // active deployment, and must not be able to move StudioNet to another
    // chain than the one it names.
    expect(NETWORKS.studionet.chainId).toBe(61999);
    expect(NETWORKS.studionet.rpcUrl).toBe("https://studio.genlayer.com/api");
  });

  it("gives the active network a Bradbury explorer", async () => {
    const { activeNetwork } = await import("./network");
    const net = activeNetwork();
    expect(net.chainId).toBe(4221);
    expect(net.explorerUrl).toBe("https://explorer-bradbury.genlayer.com");
    expect(net.gasless).toBe(false);
  });
});
