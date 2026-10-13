/**
 * Injected-wallet discovery.
 *
 * IMPORTANT AND DELIBERATE: a web page CANNOT enumerate a user's browser
 * extensions. There is no web API for that, and asking for one would be a
 * security violation. What a page can legitimately see is the set of wallet
 * providers that choose to announce themselves. That is what this module does,
 * using EIP-6963 (Multi Injected Provider Discovery, final, May 2023).
 *
 * How it works:
 *  1. We listen for `eip6963:announceProvider` and keep every provider that
 *     announces itself.
 *  2. We dispatch `eip6963:requestProvider`, which makes wallets announce again.
 *     Those two steps form a loop in the spec, so it does not matter whether
 *     the wallet's code or ours loaded first.
 *  3. `window.ethereum` is used ONLY as a fail-over, for wallets too old to
 *     implement EIP-6963. The EIP explicitly recommends this ordering.
 *
 * Security requirements honoured here, from the EIP's Security Considerations:
 *  - provider icons MUST be rendered with <img>, never injected as markup,
 *    because an SVG data URI can carry JavaScript;
 *  - providers are de-duplicated by `uuid`;
 *  - the announce listener is kept for the lifetime of the page.
 */

/** EIP-1193 request interface. Only the methods we actually call. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
  isMetaMask?: boolean;
}

/** EIP6963ProviderInfo, exactly as the spec defines it. */
export interface ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DiscoveredWallet {
  info: ProviderInfo;
  provider: Eip1193Provider;
  /** True when discovered via EIP-6963 rather than the window.ethereum fallback. */
  viaEip6963: boolean;
}

type Listener = (wallets: DiscoveredWallet[]) => void;

const listeners = new Set<Listener>();
const discovered = new Map<string, DiscoveredWallet>();

/** Fired by us so the UI can react without polling. */
const EVENT = "climateclaim:wallets";

let started = false;

/**
 * How long to wait for EIP-6963 announcements before treating a lone
 * window.ethereum as a legacy wallet. Extensions inject synchronously on load
 * and re-announce on our request event, so this only has to cover a slow
 * content script, not real network latency.
 */
const LEGACY_GRACE_MS = 400;

function emit() {
  const list = getWallets();
  listeners.forEach((fn) => fn(list));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
}

/**
 * Best-effort label and icon for a provider found through the legacy
 * `window.ethereum` path, which carries no EIP-6963 metadata.
 */
function legacyInfo(provider: Eip1193Provider): ProviderInfo {
  const isMetaMask = provider.isMetaMask === true;
  return {
    // Deterministic synthetic uuid so de-duplication still works.
    uuid: isMetaMask ? "legacy-metamask" : "legacy-injected",
    name: isMetaMask ? "MetaMask (legacy)" : "Injected wallet (legacy)",
    // Inline SVG. Rendered via <img> so it cannot execute script.
    icon:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
          '<rect width="96" height="96" rx="20" fill="#2E6C97"/>' +
          '<path d="M24 30h48l-16 19v21a5 5 0 0 1-5 5h-6a5 5 0 0 1-5-5V49z" fill="#EDF1F3"/>' +
          "</svg>",
      ),
    rdns: isMetaMask ? "io.metamask" : "legacy.injected",
  };
}

/**
 * Start discovery. Safe to call repeatedly; only the first call wires listeners.
 * Returns a teardown function.
 */
export function startWalletDiscovery(): () => void {
  if (typeof window === "undefined") return () => {};

  if (!started) {
    started = true;

    // 1. Collect announcements. Kept for the page lifetime, per the spec.
    window.addEventListener("eip6963:announceProvider", (event) => {
      const detail = (event as CustomEvent<{ info?: ProviderInfo; provider?: Eip1193Provider }>)
        .detail;
      if (!detail?.info || !detail?.provider) return;
      const { info, provider } = detail;
      // De-duplicate by uuid: a wallet re-announces on every requestProvider.
      discovered.set(info.uuid, { info, provider, viaEip6963: true });
      emit();
    });

    // 2. Ask wallets to announce. The spec's loop makes load order irrelevant.
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // 3. Fail-over ONLY, and only after EIP-6963 discovery has had a chance to
    //    answer. The EIP recommends disabling window.ethereum "except as a
    //    fail-over when discovery fails": using it while conforming wallets
    //    exist would reintroduce the exact last-one-wins race the EIP exists
    //    to remove, and a legacy wallet may well be the same wallet already
    //    announced properly.
    window.setTimeout(() => {
      if (discovered.size > 0) return;
      const legacy = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (!legacy) return;
      const info = legacyInfo(legacy);
      discovered.set(info.uuid, { info, provider: legacy, viaEip6963: false });
      emit();
    }, LEGACY_GRACE_MS);

    emit();
  }

  return () => {
    /* listeners are intentionally permanent; only the UI subscription ends */
  };
}

/** Every wallet currently known, EIP-6963 ones first. */
export function getWallets(): DiscoveredWallet[] {
  return [...discovered.values()].sort((a, b) => {
    if (a.viaEip6963 !== b.viaEip6963) return a.viaEip6963 ? -1 : 1;
    return a.info.name.localeCompare(b.info.name);
  });
}

/** Subscribe to discovery changes. Returns an unsubscribe function. */
export function subscribeWallets(fn: Listener): () => void {
  listeners.add(fn);
  fn(getWallets());
  const onEvent = () => fn(getWallets());
  window.addEventListener(EVENT, onEvent);
  return () => {
    listeners.delete(fn);
    window.removeEventListener(EVENT, onEvent);
  };
}

/** Pick a provider by uuid, or null. */
export function walletByUuid(uuid: string): DiscoveredWallet | null {
  return discovered.get(uuid) ?? null;
}

/**
 * Disconnect.
 *
 * EIP-1193 has no disconnect method, so there is no way to make a wallet
 * "forget" a dApp on its own. EIP-2255 `wallet_revokePermissions` is the
 * closest and is supported by MetaMask and several others. Not every wallet
 * implements it, so callers must treat failure as "session ended locally" and
 * say so honestly rather than claiming the wallet was disconnected.
 */
export async function revokePermissions(provider: Eip1193Provider): Promise<boolean> {
  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    return true;
  } catch {
    return false;
  }
}