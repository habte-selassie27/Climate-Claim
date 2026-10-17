/**
 * Smoke test: importing the RPC module must not throw.
 *
 * This is the check that would have caught the shipped incident. The guard ran
 * at module scope, so a bad value broke every route at import time -- and every
 * other test in the suite passed, because nothing imported the module in a
 * context that surfaced the failure.
 */
import { describe, expect, it } from "vitest";

describe("rpc module import", () => {
  it("does not throw at import time", async () => {
    await expect(import("./rpc")).resolves.toBeDefined();
  });
});
