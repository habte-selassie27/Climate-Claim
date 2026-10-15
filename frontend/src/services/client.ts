/**
 * The single GenLayer client module.
 *
 * UI.md rule: "One module creates the GenLayer client from typed config. No
 * client creation scattered through components." Components must never import
 * genlayer-js directly.
 *
 * Verified against genlayer-js@1.1.8: `createClient({ chain })`,
 * `chains.studionet`, `client.readContract({ address, functionName, args })`.
 *
 * The SDK is loaded with a dynamic import so it becomes its own chunk instead
 * of being bundled into the app shell. Both callers (`liveRead`, `runWrite`)
 * are already async, and the resolved client is cached for the session.
 */

import type { createClient } from "genlayer-js";
import { activeNetwork, EXPECTED_CHAIN_ID, NETWORKS } from "../config/network";
import type { NetworkKey } from "../config/network";

export type GenLayerClient = Awaited<ReturnType<typeof createClient>>;

let cached: Promise<GenLayerClient> | null = null;

/** Create (or reuse) the client for the configured network. Loads the SDK once. */
export function getClient(): Promise<GenLayerClient> {
  if (cached) return cached;
  cached = (async () => {
    const { createClient, chains } = await import("genlayer-js");
    const net = activeNetwork();
    const chainByNetwork: Record<NetworkKey, (typeof chains)[NetworkKey]> = {
      studionet: chains.studionet,
      testnetAsimov: chains.testnetAsimov,
      testnetBradbury: chains.testnetBradbury,
    };
    return createClient({ chain: chainByNetwork[net.key as NetworkKey] });
  })();
  return cached;
}

export { EXPECTED_CHAIN_ID, NETWORKS };
