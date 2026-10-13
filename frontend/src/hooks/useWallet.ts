import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPECTED_CHAIN_ID } from "../services/client";
import { activeNetwork } from "../config/network";
import {
  getWallets,
  revokePermissions,
  startWalletDiscovery,
  subscribeWallets,
  type DiscoveredWallet,
  type Eip1193Provider,
} from "../services/wallet";

const SELECTED_KEY = "climateclaim.selectedWallet";

export interface WalletState {
  /** Wallets that have announced themselves, EIP-6963 first. */
  wallets: DiscoveredWallet[];
  /** True when at least one wallet exists. */
  available: boolean;
  /** True once discovery has run at least once, so the UI can show a spinner. */
  discovering: boolean;
  /** The wallet the user chose, if any. */
  selected: DiscoveredWallet | null;
  /** Prompt for a wallet choice when more than one is available. */
  choose: (uuid: string) => void;
  /** Connect: opens the wallet's own approval prompt. */
  connect: () => Promise<void>;
  /** End the session locally, and ask the wallet to revoke if it can. */
  disconnect: () => Promise<{ revoked: boolean }>;
  /** Provider of the connected wallet, for reads and writes. */
  provider: Eip1193Provider | null;
  connected: boolean;
  address: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  /** Ask the wallet to switch to the configured network. */
  switchNetwork: () => Promise<boolean>;
  switching: boolean;
  /** Human-readable reason the last attempt failed. */
  error: string;
  busy: boolean;
}

function readChainId(provider: Eip1193Provider | null): Promise<number | null> {
  if (!provider) return Promise.resolve(null);
  try {
    return provider
      .request({ method: "eth_chainId" })
      .then((raw) => (typeof raw === "string" ? Number.parseInt(raw, 16) : null))
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Wallet presence, selection and connection.
 *
 * Discovery uses EIP-6963 (see services/wallet.ts) because a page cannot
 * enumerate browser extensions. Reading the contract never needs a wallet; only
 * writing does.
 */
export function useWallet(): WalletState {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(
    () => (typeof localStorage === "undefined" ? null : localStorage.getItem(SELECTED_KEY)),
  );
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState(false);

  // Discovery is a page-lifetime subscription.
  useEffect(() => {
    const stop = startWalletDiscovery();
    const unsubscribe = subscribeWallets((list) => {
      setWallets(list);
      setDiscovering(false);
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

  const selected = useMemo(
    () => wallets.find((w) => w.info.uuid === selectedUuid) ?? null,
    [wallets, selectedUuid],
  );

  const provider = selected?.provider ?? null;

  // Track chain and account changes from the connected provider.
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    const refresh = async () => {
      const id = await readChainId(provider);
      if (!cancelled) setChainId(id);
      try {
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled) return;
        setAddress(accounts?.[0] ?? null);
      } catch {
        if (!cancelled) setAddress(null);
      }
    };
    void refresh();

    const onAccounts = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      setAddress(typeof list[0] === "string" ? list[0] : null);
    };
    const onChain = () => void readChainId(provider).then((id) => !cancelled && setChainId(id));

    provider.on?.("accountsChanged" as never, onAccounts as never);
    provider.on?.("chainChanged" as never, onChain as never);
    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged" as never, onAccounts as never);
      provider.removeListener?.("chainChanged" as never, onChain as never);
    };
  }, [provider]);

  const choose = useCallback((uuid: string) => {
    setSelectedUuid(uuid);
    setError("");
    setAddress(null);
    if (typeof localStorage !== "undefined") localStorage.setItem(SELECTED_KEY, uuid);
  }, []);

  /** Auto-select when there is exactly one wallet, so the common case is one click. */
  useEffect(() => {
    if (wallets.length === 1 && !selectedUuid) {
      choose(wallets[0].info.uuid);
    }
  }, [wallets, selectedUuid, choose]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError(wallets.length ? "Choose a wallet first." : "No wallet detected.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? null);
      setChainId(await readChainId(provider));
    } catch (err) {
      const code = (err as { code?: number })?.code;
      setError(
        code === 4001
          ? "The connection request was declined."
          : "The wallet did not return an account.",
      );
    } finally {
      setBusy(false);
    }
  }, [provider, wallets.length]);

  const disconnect = useCallback(async () => {
    const target = provider;
    setAddress(null);
    setError("");
    if (!target) return { revoked: false };
    const revoked = await revokePermissions(target);
    return { revoked };
  }, [provider]);

  const switchNetwork = useCallback(async (): Promise<boolean> => {
    if (!provider) return false;
    const net = activeNetwork();
    const chainHex = `0x${net.chainId.toString(16)}`;
    setSwitching(true);
    setError("");
    try {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainHex }],
        });
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 4902) {
          // Wallet has never seen this network: add it, then switch.
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
        } else {
          setError(code === 4001 ? "The network change was declined." : "Could not switch network.");
          return false;
        }
      }
      setChainId(await readChainId(provider));
      return true;
    } catch {
      setError("Could not switch network.");
      return false;
    } finally {
      setSwitching(false);
    }
  }, [provider]);

  return {
    wallets,
    available: wallets.length > 0,
    discovering,
    selected,
    choose,
    connect,
    disconnect,
    provider,
    connected: Boolean(address),
    address,
    chainId,
    wrongNetwork: chainId !== null && chainId !== EXPECTED_CHAIN_ID,
    switchNetwork,
    switching,
    error,
    busy,
  };
}

export { getWallets };