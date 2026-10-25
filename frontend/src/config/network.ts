import { ENV_CHAIN_ID, ENV_NETWORK_KEY, ENV_RPC_URL } from "./env";

/**
 * Network configuration.
 *
 * Chain parameters come from the verified `genlayer-js` chain definitions
 * (v1.1.8), cross-checked against `genlayer config get`; explorer facts were
 * verified against the live services on 2026-10-16:
 *
 *   genlayer config get  ->  rpc_url: https://studio.genlayer.com/api
 *   StudioNet explorer   ->  https://explorer-studio.genlayer.com — serving
 *                            (the `genlayer-explorer.vercel.app` alias carried
 *                            by the chain definition returns DEPLOYMENT_PAUSED)
 *   tx deep links        ->  `<explorer>/tx/<hash>` returns 200 on StudioNet,
 *                            Asimov and Bradbury; the older
 *                            `/transaction/<hash>` path returns 404 on all
 *                            three, so links are composed from `txPath`
 *
 * These literals remain the source of truth and the fallback. A deployment may
 * override the ACTIVE network's url and chain id from the repository-root
 * `.env` (see `env.ts`): VITE_GENLAYER_RPC_URL and VITE_GENLAYER_CHAIN_ID target
 * the Bradbury entry, which is where the two contracts are deployed, and
 * VITE_GLTEST_NETWORK chooses which entry is active. Anything unset or
 * malformed falls back to the value below, so the app builds and runs
 * identically with or without a `.env`. Explorer URLs and routes, labels and
 * availability flags are deliberately NOT overridable: they encode verified
 * facts about each chain, not per-deployment settings.
 */

export type NetworkKey = "studionet" | "testnetAsimov" | "testnetBradbury";

export interface NetworkConfig {
  key: NetworkKey;
  /** Plain-language name shown in the network indicator. */
  label: string;
  chainId: number;
  rpcUrl: string;
  /** Explorer base URL, stored without a trailing slash. */
  explorerUrl: string;
  /**
   * Path prefix for a transaction deep link, appended as
   * `explorerUrl + txPath + hash`. Verified 2026-10-16: all three GenLayer
   * explorers serve `/tx/<hash>`; the `/transaction/<hash>` path returns 404.
   */
  txPath: string;
  /**
   * Whether the explorer is actually serving. When false the UI disables
   * links *with a reason* instead of presenting dead links as if they worked.
   */
  explorerAvailable: boolean;
  explorerNote: string;
  /** StudioNet is gasless; 0 GEN is expected and must not be warned about. */
  gasless: boolean;
  /** Native currency symbol, for the funded-account messaging. */
  symbol: string;
  faucetUrl: string | null;
}

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  // StudioNet is now legacy for this app: it holds the older single-contract
  // deployment and the recorded snapshot, but not the deploy the app talks to.
  // Its values are therefore plain literals -- the .env overrides below point at
  // whatever is ACTUALLY deployed, and must not be allowed to rewrite StudioNet
  // into a different chain than the one it names.
  studionet: {
    key: "studionet",
    label: "StudioNet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerUrl: "https://explorer-studio.genlayer.com",
    txPath: "/tx/",
    explorerAvailable: true,
    explorerNote: "",
    gasless: true,
    symbol: "GEN",
    faucetUrl: null,
  },
  testnetAsimov: {
    key: "testnetAsimov",
    label: "Asimov",
    chainId: 4221,
    rpcUrl: "https://rpc-asimov.genlayer.com",
    explorerUrl: "https://explorer-asimov.genlayer.com",
    txPath: "/tx/",
    explorerAvailable: true,
    explorerNote: "",
    gasless: false,
    symbol: "GEN",
    // The faucet is browser-based, so the user has to claim manually.
    faucetUrl: "https://testnet-faucet.genlayer.foundation/",
  },
  // Bradbury is where the two contracts live, so this is the entry the .env
  // overrides target (see the module comment above).
  testnetBradbury: {
    key: "testnetBradbury",
    label: "Bradbury",
    chainId: ENV_CHAIN_ID ?? 4221,
    rpcUrl: ENV_RPC_URL || "https://rpc-bradbury.genlayer.com",
    explorerUrl: "https://explorer-bradbury.genlayer.com",
    txPath: "/tx/",
    explorerAvailable: true,
    explorerNote: "",
    gasless: false,
    symbol: "GEN",
    faucetUrl: "https://testnet-faucet.genlayer.foundation/",
  },
};

/**
 * Active network: `VITE_GLTEST_NETWORK` when it names a configured network,
 * otherwise `studionet`.
 */
export const ACTIVE_NETWORK: NetworkKey = (
  Object.prototype.hasOwnProperty.call(NETWORKS, ENV_NETWORK_KEY) ? ENV_NETWORK_KEY : "studionet"
) as NetworkKey;

export function activeNetwork(): NetworkConfig {
  return NETWORKS[ACTIVE_NETWORK];
}

/**
 * Wallet chain ids we accept. StudioNet is 61999; the testnets are 4221.
 * Used by the wrong-network banner.
 */
export const EXPECTED_CHAIN_ID = NETWORKS[ACTIVE_NETWORK].chainId;
