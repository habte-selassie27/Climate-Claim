import { useMemo, useSyncExternalStore } from "react";
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
/**
 * The wallet's stable identity.
 *
 * EIP-6963 uuids are generated per provider instance, and wallets such as
 * MetaMask generate a fresh one on every page load, so a uuid persisted on one
 * load matches nothing on the next. `rdns` ("io.metamask") does not move, so it
 * is persisted alongside the uuid and used to heal a stale selection.
 */
const SELECTED_RDNS_KEY = "climateclaim.selectedWallet.rdns";

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

/**
 * Wallet presence, selection and connection — as ONE module-level store.
 *
 * This used to be plain `useState` inside the hook, which gave every caller a
 * private copy: the header's WalletPanel could be fully connected while the
 * Create-policy page still held `address === null` and answered every click
 * with "Connect a wallet first". The page's copy never re-read the wallet's
 * accounts unless its own provider effect happened to fire, and a `choose()`
 * made in the header panel never reached it at all.
 *
 * The store below fixes that class of bug by construction: every component
 * subscribes to the same state through `useSyncExternalStore`, so connecting,
 * switching account, switching chain or disconnecting updates all of them at
 * once — header, page and panels.
 *
 * Discovery uses EIP-6963 (see services/wallet.ts) because a page cannot
 * enumerate browser extensions. Reading the contract never needs a wallet;
 * only writing does.
 */
interface StoreState {
  wallets: DiscoveredWallet[];
  discovering: boolean;
  selectedUuid: string | null;
  address: string | null;
  chainId: number | null;
  error: string;
  switching: boolean;
  busy: boolean;
}

function storedValue(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    // Storage can be unavailable (private mode, embedded webviews). Selection
    // then lasts for the session only; that is better than crashing the app.
    return null;
  }
}

function persist(key: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* see storedValue */
  }
}

let state: StoreState = {
  wallets: [],
  discovering: true,
  selectedUuid: storedValue(SELECTED_KEY),
  address: null,
  chainId: null,
  error: "",
  switching: false,
  busy: false,
};

const subscribers = new Set<() => void>();

/** Replace state and notify. No-ops when nothing actually changed. */
function setState(patch: Partial<StoreState>): void {
  const changed = (Object.keys(patch) as (keyof StoreState)[]).some(
    (key) => state[key] !== patch[key],
  );
  if (!changed) return;
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

function getSnapshot(): StoreState {
  return state;
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  ensureBootstrapped();
  return () => {
    subscribers.delete(fn);
  };
}

function readChainId(provider: Eip1193Provider): Promise<number | null> {
  try {
    return provider
      .request({ method: "eth_chainId" })
      .then((raw) => (typeof raw === "string" ? Number.parseInt(raw, 16) : null))
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

async function readAccount(provider: Eip1193Provider): Promise<string | null> {
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  } catch {
    return null;
  }
}

function findWallet(uuid: string | null): DiscoveredWallet | null {
  if (!uuid) return null;
  return state.wallets.find((w) => w.info.uuid === uuid) ?? null;
}

/**
 * The currently attached provider. Tracked separately from `state` because a
 * provider object is not a renderable value; the returned `WalletState` reads
 * it directly and every change to it is accompanied by a `setState` call.
 */
let attachedProvider: Eip1193Provider | null = null;
let detachProvider: (() => void) | null = null;

/**
 * Point the store at the selected wallet's provider.
 *
 * Exactly one set of listeners exists at a time. Previously every hook instance
 * attached its own listeners to the same provider and each kept its own copy of
 * the address, which is how two parts of the UI could disagree.
 */
function syncProvider(): void {
  const provider = findWallet(state.selectedUuid)?.provider ?? null;
  if (provider === attachedProvider) return;

  detachProvider?.();
  detachProvider = null;
  attachedProvider = provider;

  if (!provider) {
    setState({ address: null, chainId: null });
    return;
  }

  const onAccounts = (accounts: unknown) => {
    const list = Array.isArray(accounts) ? accounts : [];
    setState({ address: typeof list[0] === "string" ? list[0] : null });
  };
  const onChain = () => {
    void readChainId(provider).then((id) => {
      if (attachedProvider === provider) setState({ chainId: id });
    });
  };
  provider.on?.("accountsChanged" as never, onAccounts as never);
  provider.on?.("chainChanged" as never, onChain as never);
  detachProvider = () => {
    provider.removeListener?.("accountsChanged" as never, onAccounts as never);
    provider.removeListener?.("chainChanged" as never, onChain as never);
  };

  // Initial read: `eth_accounts` returns the account without a prompt when the
  // site was already authorised, so a reload restores "connected" on its own.
  void Promise.all([readChainId(provider), readAccount(provider)]).then(([id, account]) => {
    if (attachedProvider !== provider) return;
    setState({ chainId: id, address: account });
  });
}

let bootstrapped = false;

function ensureBootstrapped(): void {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  startWalletDiscovery();
  subscribeWallets((list) => {
    setState({ wallets: list, discovering: false });

    // Keep the selection pointing at a wallet that actually exists. A stored
    // uuid can go stale across page loads (see SELECTED_RDNS_KEY); the stable
    // rdns recovers the user's choice, and a lone wallet needs no guesswork.
    const current = state.selectedUuid;
    const stillPresent = current !== null && list.some((w) => w.info.uuid === current);
    if (!stillPresent) {
      const storedRdns = storedValue(SELECTED_RDNS_KEY);
      const byRdns = storedRdns ? (list.find((w) => w.info.rdns === storedRdns) ?? null) : null;
      const fallback = byRdns ?? (list.length === 1 ? list[0] : null);
      if (fallback) {
        persist(SELECTED_KEY, fallback.info.uuid);
        persist(SELECTED_RDNS_KEY, fallback.info.rdns);
        setState({ selectedUuid: fallback.info.uuid });
      }
    }

    syncProvider();
  });
}

function choose(uuid: string): void {
  const wallet = findWallet(uuid);
  persist(SELECTED_KEY, uuid);
  if (wallet) persist(SELECTED_RDNS_KEY, wallet.info.rdns);
  setState({ selectedUuid: uuid, address: null, error: "" });
  syncProvider();
}

async function connect(): Promise<void> {
  const provider = attachedProvider;
  if (!provider) {
    setState({ error: state.wallets.length ? "Choose a wallet first." : "No wallet detected." });
    return;
  }
  setState({ busy: true, error: "" });
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    setState({ address: accounts?.[0] ?? null, chainId: await readChainId(provider) });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    setState({
      error:
        code === 4001
          ? "The connection request was declined."
          : "The wallet did not return an account.",
    });
  } finally {
    setState({ busy: false });
  }
}

async function disconnect(): Promise<{ revoked: boolean }> {
  const target = attachedProvider;
  setState({ address: null, error: "" });
  if (!target) return { revoked: false };
  const revoked = await revokePermissions(target);
  return { revoked };
}

async function switchNetwork(): Promise<boolean> {
  const provider = attachedProvider;
  if (!provider) return false;
  const net = activeNetwork();
  const chainHex = `0x${net.chainId.toString(16)}`;
  setState({ switching: true, error: "" });
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
        setState({
          error: code === 4001 ? "The network change was declined." : "Could not switch network.",
        });
        return false;
      }
    }
    setState({ chainId: await readChainId(provider) });
    return true;
  } catch {
    setState({ error: "Could not switch network." });
    return false;
  } finally {
    setState({ switching: false });
  }
}

/**
 * Read the shared wallet store. Safe to call from any component: every caller
 * sees the same connection, and any change re-renders all of them.
 */
export function useWallet(): WalletState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo<WalletState>(() => {
    const selected = findWallet(snapshot.selectedUuid);
    return {
      wallets: snapshot.wallets,
      available: snapshot.wallets.length > 0,
      discovering: snapshot.discovering,
      selected,
      choose,
      connect,
      disconnect,
      provider: attachedProvider,
      connected: Boolean(snapshot.address),
      address: snapshot.address,
      chainId: snapshot.chainId,
      wrongNetwork: snapshot.chainId !== null && snapshot.chainId !== EXPECTED_CHAIN_ID,
      switchNetwork,
      switching: snapshot.switching,
      error: snapshot.error,
      busy: snapshot.busy,
    };
  }, [snapshot]);
}

/**
 * Non-hook accessor for service code (the write path): the connected wallet as
 * an EIP-1193 signer. Null when no account is connected.
 *
 * The provider returned is the SELECTED wallet's own provider, so a machine
 * with several installed wallets cannot silently sign through the wrong one.
 */
export function currentSigner(): { account: string; provider: Eip1193Provider | null } | null {
  return state.address ? { account: state.address, provider: attachedProvider } : null;
}

export { getWallets };
