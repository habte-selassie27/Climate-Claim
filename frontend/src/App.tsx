import { Suspense, lazy } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import { activeNetwork } from "./config/network";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS, POLICY_ADDRESS } from "./config/contracts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WalletPanel } from "./components/WalletPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useI18n } from "./i18n/I18nProvider";

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
  const { t } = useI18n();
  return (
    <header className="chrome">
      <div className="chrome-inner">
        <Link className="brand" to="/">
          <BrandMark />
          ClimateClaim
        </Link>

        <nav className="chrome-nav" aria-label={t("nav.main")}>
          <NavLink to="/">{t("nav.home")}</NavLink>
          <NavLink to="/demo">{t("nav.demo")}</NavLink>
          <NavLink to="/claims">{t("nav.claims")}</NavLink>
          <NavLink to="/policies">{t("nav.policies")}</NavLink>
          <NavLink to="/how-it-works">{t("nav.howItWorks")}</NavLink>
        </nav>

        <div className="chrome-status">
          <span className="badge" title={t("common.chain", { id: net.chainId })}>
            <span aria-hidden="true">◈</span> {net.label}
          </span>
          {wallet.wrongNetwork && wallet.connected ? (
            <span className="badge badge-sim" role="alert">
              {t("nav.wrongNetwork", { id: wallet.chainId ?? "—" })}
            </span>
          ) : null}
          <LanguageSwitcher />
          <ThemeToggle />
          {/* One control for the whole wallet lifecycle: discover, choose,
              connect, show address, copy, switch network, disconnect. */}
          <WalletPanel />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <strong>ClimateClaim</strong>
          <div className="small">{t("footer.tagline")}</div>
        </div>
        <div>
          <div className="small">
            {t("audit.contract")} <span className="mono">{CONTRACT_ADDRESS}</span>
          </div>
          {/* The project deploys as two contracts, so naming only the claim one
              understates what is on chain and hides where policies are read
              from. Both are listed. */}
          <div className="small">
            {t("audit.policyContract")} <span className="mono">{POLICY_ADDRESS}</span>
          </div>
          <div className="small">
            {net.label} · {t("common.chain", { id: net.chainId })}
          </div>
          {net.explorerAvailable ? (
            <div className="small">
              <a href={net.explorerUrl} target="_blank" rel="noreferrer noopener">
                {t("footer.explorer")}
              </a>
            </div>
          ) : (
            <div className="small muted">{t("footer.explorerPaused")}</div>
          )}
        </div>
        <div>
          <div className="small">
            <Link to="/how-it-works">{t("nav.howItWorks")}</Link>
          </div>
          <div className="small">
            <Link to="/demo">{t("footer.demoMode")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const { t } = useI18n();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t("nav.skipToMain")}
      </a>
      <Chrome />
      <main id="main">
        <div className="container">
          {/* Boundary outside Suspense: a crashing page (or a failed chunk
              load) shows the fallback while the chrome and every other route
              stay usable. */}
          <ErrorBoundary>
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
                      <strong>{t("nav.notFound.h")}</strong>
                      <p>{t("nav.notFound.body")}</p>
                      <Link className="btn btn-secondary" to="/">
                        {t("nav.home")}
                      </Link>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </div>
  );
}