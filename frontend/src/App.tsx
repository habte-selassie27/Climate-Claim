import { NavLink, Route, Routes, Link } from "react-router-dom";
import { activeNetwork } from "./config/network";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS } from "./config/contracts";
import { truncateAddress } from "./domain/format";
import { Landing } from "./pages/Landing";
import { Claims } from "./pages/Claims";
import { ClaimDetail } from "./pages/ClaimDetail";
import { Demo } from "./pages/Demo";
import { Policies, PolicyDetail } from "./pages/Policies";
import { PolicyNew } from "./pages/PolicyNew";
import { HowItWorks } from "./pages/HowItWorks";

const net = activeNetwork();

function BrandMark() {
  // A rain gauge: a funnel over a graduated column. Drawn, not an icon font.
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 3h16l-6 7v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="10" y="16" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 21h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18.5v1.5" stroke="var(--isobar)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Chrome() {
  const wallet = useWallet();
  return (
    <header className="chrome">
      <div className="chrome-inner">
        <Link className="brand" to="/">
          <BrandMark />
          ClimateClaim
        </Link>

        <nav className="chrome-nav" aria-label="Main">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/demo">Demo</NavLink>
          <NavLink to="/claims">Claims</NavLink>
          <NavLink to="/policies">Policies</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
        </nav>

        <div className="chrome-status">
          <span className="badge" title={`Chain ${net.chainId}`}>
            <span aria-hidden="true">◈</span> {net.label}
          </span>
          {wallet.wrongNetwork ? (
            <button
              type="button"
              className="copy-btn badge-wrongnet"
              role="alert"
              onClick={() => void wallet.switchNetwork()}
              disabled={wallet.switching}
              title={`Your wallet is on chain ${wallet.chainId}. Click to switch to ${net.label} (chain ${net.chainId}).`}
            >
              <span aria-hidden="true">⚠</span> Wrong network ({wallet.chainId}) — switch
            </button>
          ) : wallet.connected && wallet.address ? (
            <span className="badge badge-live" title={wallet.address}>
              <span aria-hidden="true">◉</span> {truncateAddress(wallet.address)}
            </span>
          ) : (
            <button type="button" className="copy-btn" onClick={() => void wallet.request()}>
              {wallet.available ? "Connect wallet" : "Read-only"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <strong>ClimateClaim</strong>
          <div className="small">Evidence-based parametric weather claims on GenLayer.</div>
        </div>
        <div>
          <div className="small">
            Contract <span className="mono">{CONTRACT_ADDRESS}</span>
          </div>
          <div className="small">
            {net.label} · chain {net.chainId}
          </div>
          {net.explorerAvailable ? (
            <div className="small">
              <a href={net.explorerUrl} target="_blank" rel="noreferrer noopener">
                Explorer
              </a>
            </div>
          ) : (
            <div className="small muted">Explorer currently paused</div>
          )}
        </div>
        <div>
          <div className="small">
            <Link to="/how-it-works">How it works</Link>
          </div>
          <div className="small">
            <Link to="/demo">Demo mode</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Chrome />
      <main id="main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/claims/:id" element={<ClaimDetail />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/policies/new" element={<PolicyNew />} />
            <Route path="/policies/:id" element={<PolicyDetail />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route
              path="*"
              element={
                <div className="alert alert-warn">
                  <strong>Page not found</strong>
                  <p>That address does not match a page in this app.</p>
                  <Link className="btn btn-secondary" to="/">
                    Back to the start
                  </Link>
                </div>
              }
            />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}