import { useEffect, useState } from "react";
import { EXPECTED_CHAIN_ID, detectWalletChainId } from "../services/client";

export interface WalletState {
  /** True when a wallet provider exists at all (e.g. a browser extension). */
  available: boolean;
  connected: boolean;
  address: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  request: () => Promise<void>;
}

/**
 * Wallet presence and network check.
 *
 * Reads never require a wallet. The wrong-network state is a blocking banner,
 * not a crash, and no-wallet is explained rather than treated as an error.
 */
export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void detectWalletChainId().then((id) => {
      if (!cancelled) setChainId(id);
    });
    const eth = (window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum;
    if (!cancelled) setAvailable(Boolean(eth));
    return () => {
      cancelled = true;
    };
  }, []);

  const request = async () => {
    if (typeof window === "undefined" || !("ethereum" in window)) return;
    try {
      const provider = (
        window as unknown as {
          ethereum: { request: (a: { method: string }) => Promise<unknown> };
        }
      ).ethereum;
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? null);
      setChainId(await detectWalletChainId());
    } catch {
      setAddress(null);
    }
  };

  return {
    available,
    connected: Boolean(address),
    address,
    chainId,
    wrongNetwork: chainId !== null && chainId !== EXPECTED_CHAIN_ID,
    request,
  };
}