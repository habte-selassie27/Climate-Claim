import { Suspense, lazy } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import { activeNetwork } from "./config/network";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS } from "./config/contracts";
import { WalletPanel } from "./components/WalletPanel";

/**
 * Route-level code splitting. Every page pulls the genlayer-js SDK (the bulk of
 * the bundle) through services/claimService, so loading routes lazily keeps the
 * app shell and first paint small and defers the SDK until it is needed.
 */
const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const Claims = lazy(() => import("./pages/Claims").then((m) => ({ default: m.Claims })));
const ClaimDetail = lazy(() =>
  import("./pages/ClaimDetail").then((m) => ({ default: m.ClaimDetail })),
);
const Demo = lazy(() => import("./pages/Demo").then((m) => ({ default: m.Demo })));
const Policies = lazy(() => import("./pages/Policies").then((m) => ({ default: m.Policies })));
const PolicyDetail = lazy(() =>
  import("./pages/Policies").then((m) => ({ default: m.PolicyDetail })),
);
const PolicyNew = lazy(() => import("./pages/PolicyNew").then((m) => ({ default: m.PolicyNew })));
const HowItWorks = lazy(() =>
  import("./pages/HowItWorks").then((m) => ({ default: m.HowItWorks })),
);

/** Shown while a route chunk (and the SDK it carries) loads. */
function RouteFallback() {
  return (
    <div className="stack" aria-busy="true" style={{ padding: "var(--space-6) 0" }}>
      <div className="skeleton" style={{ width: "40%", height: 28 }} />
      <div className="panel">
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "55%", marginTop: 12 }} />
      </div>
    </div>
  );
}

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
          {wallet.wrongNetwork && wallet.connected ? (
            <span className="badge badge-sim" role="alert">
              Wrong network ({wallet.chainId})
            </span>
          ) : null}
          {/* One control for the whole wallet lifecycle: discover, choose,
              connect, show address, copy, switch network, disconnect. */}
          <WalletPanel />
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
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}