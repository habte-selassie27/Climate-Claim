/**
 * The single GenLayer client module.
 *
 * UI.md rule: "One module creates the GenLayer client from typed config. No
 * client creation scattered through components." Components must never import
 * genlayer-js directly.
 *
 * Verified against genlayer-js@1.1.8:
 *   - `createClient({ chain })`, `chains.*`, `client.readContract({ ... })`.
 *   - `client.writeContract({ ... })` needs a sender account. With none set it
 *     throws "No account set. Configure the client with an account or pass an
 *     account to this function." — that is the error the Create-policy page
 *     surfaced before these two factories were split.
 *   - Given `account` as a plain address (NOT a viem Account object), the SDK
 *     routes the signing methods (`eth_sendTransaction`, `personal_sign`, ...)
 *     to the configured `provider`, so the browser wallet prompts and signs.
 *     That is the path used here; a private key never touches this codebase.
 *
 * The SDK is loaded with a dynamic import so it becomes its own chunk instead
 * of being bundled into the app shell. The read client is cached for the
 * session; the signing client is cached per (account, provider) pair so an
 * account switch can never reuse a client that signs as the old account.
 */

import type { createClient } from "genlayer-js";
import { activeNetwork, EXPECTED_CHAIN_ID, NETWORKS } from "../config/network";
import type { NetworkKey } from "../config/network";
import type { Eip1193Provider } from "./wallet";

export type GenLayerClient = Awaited<ReturnType<typeof createClient>>;

/** The SDK's own client configuration type, so boundary casts stay honest. */
type ClientConfig = NonNullable<Parameters<typeof createClient>[0]>;

async function buildClient(extra: Partial<ClientConfig>): Promise<GenLayerClient> {
  const { createClient, chains } = await import("genlayer-js");
  const net = activeNetwork();
  const chainByNetwork: Record<NetworkKey, (typeof chains)[NetworkKey]> = {
    studionet: chains.studionet,
    testnetAsimov: chains.testnetAsimov,
    testnetBradbury: chains.testnetBradbury,
  };
  return createClient({ chain: chainByNetwork[net.key as NetworkKey], ...extra });
}

let cached: Promise<GenLayerClient> | null = null;

/** Create (or reuse) the read-only client. Loads the SDK once. */
export function getClient(): Promise<GenLayerClient> {
  if (cached) return cached;
  cached = buildClient({});
  return cached;
}

let signing: {
  account: string;
  provider: Eip1193Provider | null;
  client: Promise<GenLayerClient>;
} | null = null;

/**
 * Create (or reuse) a client that can SEND transactions as `account`.
 *
 * `account` is the connected wallet's address and `provider` is that wallet's
 * own EIP-1193 provider — the SELECTED EIP-6963 wallet, not whichever extension
 * happens to own `window.ethereum`. The SDK checks the wallet's chain against
 * the configured network before sending, and the wallet itself shows the
 * approval prompt. Recreated whenever either input changes.
 */
export function getWriteClient(
  account: string,
  provider: Eip1193Provider | null,
): Promise<GenLayerClient> {
  if (
    signing &&
    signing.account.toLowerCase() === account.toLowerCase() &&
    signing.provider === provider
  ) {
    return signing.client;
  }
  signing = {
    account,
    provider,
    client: buildClient({
      // Addresses from the wallet (`eth_accounts`) are 0x-hex; the SDK types
      // this as viem's `0x${string}` template-literal type.
      account: account as `0x${string}`,
      // The SDK's config type is viem's EthereumProvider shape; the discovered
      // wallet implements the same EIP-1193 request surface.
      ...(provider ? { provider: provider as unknown as ClientConfig["provider"] } : {}),
    }),
  };
  return signing.client;
}

export { EXPECTED_CHAIN_ID, NETWORKS };
