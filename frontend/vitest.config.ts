import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure domain + service logic.
 *
 * These deliberately do NOT touch the network, the SDK or a DOM: they cover the
 * deterministic helpers the audit flagged as needing tests — error-prefix
 * mapping, the accepted-vs-finalized tx phase mapping, and the scaled-integer /
 * coordinate / period formatters that guard against the `Number("") === 0`
 * empty-string bug.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The service layer imports a JSON snapshot and a lazily-created SDK
    // client; neither is exercised here, but keep the pool small and quiet.
    pool: "threads",
  },
});
