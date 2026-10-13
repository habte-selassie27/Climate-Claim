import { useEffect, useRef, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { activeNetwork } from "../config/network";
import { EXPECTED_CHAIN_ID } from "../services/client";

const net = activeNetwork();

/**
 * Wallet control.
 *
 * One place holding the whole wallet lifecycle:
 *   discover -> choose -> connect -> (address, copy, switch, disconnect)
 *
 * Honesty rules:
 *  - a page cannot enumerate browser extensions, so the list is only wallets
 *    that announced themselves via EIP-6963 (plus a legacy window.ethereum
 *    fail-over). See services/wallet.ts.
 *  - "Disconnect" ends the session locally. EIP-1193 has no disconnect, so we
 *    attempt EIP-2255 `wallet_revokePermissions` and say plainly when the
 *    wallet does not support it, rather than implying a stronger guarantee.
 *  - wallet icons render through <img> because an SVG data URI can carry
 *    JavaScript (EIP-6963 security consideration).
 */
export function WalletPanel() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [sheetStyle, setSheetStyle] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * The sheet is fixed and positioned from the trigger's rect, then clamped to
   * the viewport. An absolutely-positioned sheet cannot do this: the header can
   * wrap, which moves the trigger to the left of the viewport and pushes an
   * absolutely-positioned `right: 0` sheet off-screen.
   */
  useEffect(() => {
    if (!open || !triggerRef.current) {
      setSheetStyle(null);
      return;
    }
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(340, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
      setSheetStyle({ top: Math.round(r.bottom + 8), left: Math.round(left) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, wallet.wallets.length, wallet.connected, wallet.chainId]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyAddress = async () => {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNote("Your browser blocked clipboard access. Select the address and copy it manually.");
    }
  };

  const onDisconnect = async () => {
    const { revoked } = await wallet.disconnect();
    setNote(
      revoked
        ? "Disconnected. The wallet revoked this site's access."
        : "Signed out in this tab. This wallet does not support permission revocation, so it may still list this site under its connected-apps. Disconnect there too if you want it removed.",
    );
  };

  return (
    <div className="wallet-panel" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={`wallet-trigger ${wallet.connected ? "is-connected" : ""} ${
          wallet.wrongNetwork ? "is-wrongnet" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={wallet.discovering}
        title={
          wallet.address
            ? `Connected as ${wallet.address}`
            : wallet.available
              ? "Connect a wallet"
              : "No wallet detected"
        }
      >
        {wallet.connected && wallet.selected ? (
          <img className="wallet-icon" src={wallet.selected.info.icon} alt="" aria-hidden="true" />
        ) : (
          <span className="wallet-icon wallet-icon-empty" aria-hidden="true">
            ◉
          </span>
        )}
        <span className="wallet-label">
          {wallet.discovering
            ? "Scanning…"
            : wallet.connected
              ? shorten(wallet.address ?? "")
              : wallet.available
                ? "Connect wallet"
                : "Read-only"}
        </span>
        {wallet.wrongNetwork ? (
          <span className="wallet-warn" title={`Wallet is on chain ${wallet.chainId}`}>
            ⚠
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="wallet-sheet"
          style={sheetStyle ? { top: sheetStyle.top, left: sheetStyle.left } : undefined}
          role="dialog"
          aria-label="Wallet"
        >
          <div className="wallet-sheet-head">
            <h2 className="wallet-sheet-title">Wallet</h2>
            <button
              type="button"
              className="copy-btn"
              onClick={() => setOpen(false)}
              aria-label="Close wallet panel"
            >
              ✕
            </button>
          </div>

          <p className="small muted">
            Network: <strong>{net.label}</strong> (chain {net.chainId}).
            {wallet.chainId !== null ? ` Your wallet is on chain ${wallet.chainId}.` : ""}
          </p>

          {wallet.error ? (
            <div className="alert alert-warn" role="alert">
              <p className="small" style={{ margin: 0 }}>
                {wallet.error}
              </p>
            </div>
          ) : null}

          {/* --- wallet choice ------------------------------------------- */}
          <h3 className="wallet-section">Detected wallets</h3>
          {wallet.wallets.length === 0 ? (
            <p className="small muted">
              No injected wallet found. A web page cannot list installed browser
              extensions — it can only see wallets that announce themselves. Install or
              unlock a wallet extension (MetaMask, Rabby, Brave and others) and reload.
            </p>
          ) : (
            <ul className="wallet-list">
              {wallet.wallets.map((w) => {
                const isSelected = w.info.uuid === wallet.selected?.info.uuid;
                return (
                  <li key={w.info.uuid}>
                    <button
                      type="button"
                      className={`wallet-option ${isSelected ? "is-selected" : ""}`}
                      onClick={() => wallet.choose(w.info.uuid)}
                      aria-pressed={isSelected}
                    >
                      <img className="wallet-icon" src={w.info.icon} alt="" aria-hidden="true" />
                      <span>
                        <span className="wallet-option-name">{w.info.name}</span>
                        <span className="wallet-option-rdns mono">{w.info.rdns}</span>
                      </span>
                      {isSelected ? <span className="wallet-check">✓</span> : null}
                      {!w.viaEip6963 ? (
                        <span className="wallet-tag" title="Found via window.ethereum; this wallet does not implement EIP-6963.">
                          legacy
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {wallet.wallets.length > 1 ? (
            <p className="small muted">
              More than one wallet is installed. Pick which one this app talks to — without
              EIP-6963, whichever loaded last would silently win.
            </p>
          ) : null}

          {/* --- connected account --------------------------------------- */}
          {wallet.connected ? (
            <>
              <h3 className="wallet-section">Account</h3>
              <div className="wallet-account">
                <span className="wallet-address mono" title={wallet.address ?? ""}>
                  {wallet.address}
                </span>
                <div className="btn-row">
                  <button type="button" className="copy-btn" onClick={() => void copyAddress()}>
                    {copied ? "Copied ✓" : "Copy address"}
                  </button>
                  {wallet.wrongNetwork ? (
                    <button
                      type="button"
                      className="copy-btn wallet-btn-primary"
                      onClick={() => void wallet.switchNetwork()}
                      disabled={wallet.switching}
                    >
                      {wallet.switching ? "Switching…" : `Switch to ${net.label}`}
                    </button>
                  ) : null}
                  <button type="button" className="copy-btn" onClick={() => void onDisconnect()}>
                    Disconnect
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="btn-row" style={{ marginTop: "var(--space-3)" }}>
              <button
                type="button"
                className="btn"
                onClick={() => void wallet.connect()}
                disabled={wallet.busy || !wallet.selected}
              >
                {wallet.busy ? "Waiting for approval…" : "Connect"}
              </button>
              {!wallet.selected ? (
                <span className="small muted">Choose a wallet above first.</span>
              ) : null}
            </div>
          )}

          {note ? (
            <p className="small muted wallet-note" role="status">
              {note}
            </p>
          ) : null}

          <p className="small muted wallet-footnote">
            Reading needs no wallet. Sending a transaction requires chain {EXPECTED_CHAIN_ID}.
            {net.gasless ? ` ${net.label} is gasless, so a transaction costs nothing.` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function shorten(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}