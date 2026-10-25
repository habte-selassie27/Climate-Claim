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
    for (const method of ["start_claim", "sync_evaluation", "settle_claim", "fund"]) {
      expect(addressFor(method), method).toBe(CONTRACT_ADDRESS);
    }
  });

  it("sends the consensus round and its result to the evaluator", async () => {
    const { addressFor, EVALUATOR_ADDRESS } = await import("./contracts");
    for (const method of ["evaluate_for_claim", "get_result"]) {
      expect(addressFor(method), method).toBe(EVALUATOR_ADDRESS);
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
  it("are well-formed and distinct", async () => {
    const { CONTRACT_ADDRESS, EVALUATOR_ADDRESS, POLICY_ADDRESS } = await import("./contracts");
    for (const address of [CONTRACT_ADDRESS, POLICY_ADDRESS, EVALUATOR_ADDRESS]) {
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
    expect(new Set([CONTRACT_ADDRESS, POLICY_ADDRESS, EVALUATOR_ADDRESS]).size).toBe(3);
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
    expect(DEPLOYER_ADDRESS).toBe("0x5B3661C576c7001e6d6279C67F3779705d334c89");
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

  it("exposes a two-step evaluation that never takes a decision", async () => {
    const { METHOD_META } = await import("./contracts");
    expect(METHOD_META.evaluate_for_claim.contract).toBe("evaluator");
    expect(METHOD_META.evaluate_for_claim.readonly).toBe(false);
    expect(METHOD_META.sync_evaluation.contract).toBe("claim");
    expect(METHOD_META.sync_evaluation.readonly).toBe(false);
    // No method that stores a caller-supplied decision may reappear: that is the
    // exact shape the project was rejected for.
    expect("record_evaluation" in METHOD_META).toBe(false);
    expect("resolve_dispute" in METHOD_META).toBe(false);
    expect("request_evaluation" in METHOD_META).toBe(false);
  });
});

describe("declared unavailability", () => {
  it("records that fetching and consensus live in the evaluator", async () => {
    const { AVAILABILITY: availability } = await import("./contracts");
    expect(availability.request_evaluation).toBe("evaluator");
    expect(availability.evaluate_from_web).toBe("evaluator");
    expect(availability.get_criteria_version).toBe("evaluator");
  });

  it("stores per-check results with the consensus result", async () => {
    const { AVAILABILITY: availability, METHOD_META: meta } = await import("./contracts");
    expect(availability.get_checks).toBe("evaluator");
    // There is still no `get_checks` method: checks travel inside get_result.
    expect("get_checks" in meta).toBe(false);
  });

  it("routes the engine method to the policy contract", async () => {
    const { addressFor, POLICY_ADDRESS, METHOD_META: meta } = await import("./contracts");
    expect("compute_evaluation" in meta).toBe(true);
    expect(addressFor("compute_evaluation")).toBe(POLICY_ADDRESS);
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
  it("is StudioNet, where the contracts are deployed", async () => {
    const { ACTIVE_NETWORK } = await import("./network");
    expect(ACTIVE_NETWORK).toBe("studionet");
  });

  it("gives the active network a StudioNet explorer", async () => {
    const { activeNetwork } = await import("./network");
    const net = activeNetwork();
    expect(net.chainId).toBe(61999);
    expect(net.explorerUrl).toBe("https://explorer-studio.genlayer.com");
    expect(net.gasless).toBe(true);
  });
});
