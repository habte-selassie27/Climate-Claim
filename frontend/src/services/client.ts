/**
 * The single GenLayer client module.
 *
 * UI.md rule: "One module creates the GenLayer client from typed config. No
 * client creation scattered through components." Components must never import
 * genlayer-js directly.
 *
 * Verified against genlayer-js@1.1.8: `createClient({ chain })`,
 * `chains.studionet`, `client.readContract({ address, functionName, args })`.
 */

import { createClient, chains } from "genlayer-js";
import { activeNetwork, EXPECTED_CHAIN_ID, NETWORKS } from "../config/network";
import type { NetworkKey } from "../config/network";

const CHAIN_BY_KEY = {
  studionet: chains.studionet,
  testnetAsimov: chains.testnetAsimov,
  testnetBradbury: chains.testnetBradbury,
} as const;

export type GenLayerClient = ReturnType<typeof createClient>;

let cached: GenLayerClient | null = null;

export function getClient(): GenLayerClient {
  if (cached) return cached;
  const net = activeNetwork();
  cached = createClient({ chain: CHAIN_BY_KEY[net.key as NetworkKey] });
  return cached;
}

/** True when a wallet chain id matches the network we are configured for. */
export function isExpectedChain(chainId: number | undefined): boolean {
  return chainId === EXPECTED_CHAIN_ID;
}

/**
 * Detect a wrong-network wallet. Returns the connected chain id, or null when
 * no wallet is connected (in which case reads still work).
 */
export async function detectWalletChainId(): Promise<number | null> {
  if (typeof window === "undefined" || !("ethereum" in window)) return null;
  try {
    const provider = (window as unknown as { ethereum: { request: (a: unknown) => Promise<unknown> } }).ethereum;
    const raw = await provider.request({ method: "eth_chainId" });
    return typeof raw === "string" ? Number.parseInt(raw, 16) : null;
  } catch {
    return null;
  }
}

export { EXPECTED_CHAIN_ID, NETWORKS };