import { useCallback, useEffect, useState } from "react";
import { EXPECTED_CHAIN_ID, detectWalletChainId } from "../services/client";
import { activeNetwork } from "../config/network";

export interface WalletState {
  /** True when a wallet provider exists at all (e.g. a browser extension). */
  available: boolean;
  connected: boolean;
  address: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  request: () => Promise<void>;
  /**
   * Ask the wallet to switch to the configured network.
   * Resolves true on success, false when the user declines or the wallet
   * refuses. Never throws, so callers can stay declarative.
   */
  switchNetwork: () => Promise<boolean>;
  /** True while a switch request is in flight, so the button can disable. */
  switching: boolean;
  /** Human-readable reason the last switch attempt did not succeed. */
  switchError: string;
}

/**
 * Wallet presence and network check.
 *
 * Reads never require a wallet. The wrong-network state is a blocking banner,
 * not a crash, and no-wallet is explained rather than treated as an error.
 *
 * Network switching uses the EIP-3326 method `wallet_switchEthereumChain`.
 * If the network is not yet known to the wallet it first attempts
 * `wallet_addEthereumChain`, then retries the switch. Both parameters are built
 * from `config/network.ts` rather than hardcoded here.
 */
export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  const readChainId = useCallback(async () => {
    setChainId(await detectWalletChainId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectWalletChainId().then((id) => {
      if (!cancelled) setChainId(id);
    });
    const eth = (window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum;
    if (!cancelled) setAvailable(Boolean(eth));

    // The wallet can change network or account without a reload. Listen for
    // both, so the header badge does not go stale after the user switches.
    const provider = (window as unknown as { ethereum?: { on?: Function; removeListener?: Function } })
      .ethereum;
    const onAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      setAddress(typeof list[0] === "string" ? list[0] : null);
      void readChainId();
    };
    provider?.on?.("accountsChanged", onAccountsChanged);
    provider?.on?.("chainChanged", () => void readChainId());

    return () => {
      cancelled = true;
      provider?.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [readChainId]);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("ethereum" in window)) return;
    try {
      const provider = (
        window as unknown as {
          ethereum: { request: (a: { method: string }) => Promise<unknown> };
        }
      ).ethereum;
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? null);
      await readChainId();
    } catch {
      setAddress(null);
    }
  }, [readChainId]);

  const switchNetwork = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("ethereum" in window)) return false;
    const net = activeNetwork();
    const chainHex = `0x${net.chainId.toString(16)}`;
    setSwitching(true);
    setSwitchError("");
    try {
      const provider = (
        window as unknown as {
          ethereum: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
        }
      ).ethereum;

      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainHex }],
        });
      } catch (err) {
        // 4902 = the chain is not known to the wallet yet. Offer to add it,
        // then switch again. This is the usual first-run experience.
        const code = (err as { code?: number })?.code;
        if (code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainHex,
                chainName: net.label,
                nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 },
                rpcUrls: [net.rpcUrl],
              },
            ],
          });
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainHex }],
          });
        } else if (code === 4001) {
          setSwitchError("The network change was declined.");
          return false;
        } else {
          setSwitchError("The wallet could not switch networks.");
          return false;
        }
      }

      await readChainId();
      return true;
    } catch {
      setSwitchError("The wallet could not switch networks.");
      return false;
    } finally {
      setSwitching(false);
    }
  }, [readChainId]);

  return {
    available,
    connected: Boolean(address),
    address,
    chainId,
    wrongNetwork: chainId !== null && chainId !== EXPECTED_CHAIN_ID,
    request,
    switchNetwork,
    switching,
    switchError,
  };
}