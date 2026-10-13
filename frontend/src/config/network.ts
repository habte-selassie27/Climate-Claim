/**
 * Network configuration.
 *
 * Values here are NOT guesses. They are taken from the verified `genlayer-js`
 * chain definitions (v1.1.8), cross-checked against `genlayer config get`:
 *
 *   genlayer config get  ->  rpc_url: https://studio.genlayer.com/api
 *   chains.studionet    ->  id 61999, explorer https://genlayer-explorer.vercel.app
 *
 * To change networks, edit this file only. No literals anywhere else.
 */

export type NetworkKey = "studionet" | "testnetAsimov" | "testnetBradbury";

export interface NetworkConfig {
  key: NetworkKey;
  /** Plain-language name shown in the network indicator. */
  label: string;
  chainId: number;
  rpcUrl: string;
  /**
   * Explorer base URL from the verified chain definition.
   *
   * HONESTY NOTE: the StudioNet explorer deployment is currently returning
   * "DEPLOYMENT_PAUSED", so links built from this URL do not resolve right now.
   * The UI therefore shows the explorer link *disabled with a reason* rather
   * than presenting a dead link as if it worked. See `explorerAvailability`.
   */
  explorerUrl: string;
  /**
   * Whether the explorer is actually serving. Verified 2026-10-13: StudioNet
   * explorer returns DEPLOYMENT_PAUSED. Set to false and the UI hides links.
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
  studionet: {
    key: "studionet",
    label: "StudioNet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerUrl: "https://genlayer-explorer.vercel.app",
    explorerAvailable: false,
    explorerNote:
      "The StudioNet explorer deployment is paused, so transaction links do not resolve right now. Hashes shown here were read from the network directly.",
    gasless: true,
    symbol: "GEN",
    faucetUrl: null,
  },
  testnetAsimov: {
    key: "testnetAsimov",
    label: "Asimov",
    chainId: 4221,
    rpcUrl: "https://rpc-asimov.genlayer.com",
    explorerUrl: "https://explorer-asimov.genlayer.com/",
    explorerAvailable: true,
    explorerNote: "",
    gasless: false,
    symbol: "GEN",
    // The faucet is browser-based, so the user has to claim manually.
    faucetUrl: "https://testnet-faucet.genlayer.foundation/",
  },
  testnetBradbury: {
    key: "testnetBradbury",
    label: "Bradbury",
    chainId: 4221,
    rpcUrl: "https://rpc-bradbury.genlayer.com",
    explorerUrl: "https://explorer-bradbury.genlayer.com/",
    explorerAvailable: true,
    explorerNote: "",
    gasless: false,
    symbol: "GEN",
    faucetUrl: "https://testnet-faucet.genlayer.foundation/",
  },
};

export const ACTIVE_NETWORK: NetworkKey = "studionet";

export function activeNetwork(): NetworkConfig {
  return NETWORKS[ACTIVE_NETWORK];
}

/**
 * Wallet chain ids we accept. StudioNet is 61999; the testnets are 4221.
 * Used by the wrong-network banner.
 */
export const EXPECTED_CHAIN_ID = NETWORKS[ACTIVE_NETWORK].chainId;