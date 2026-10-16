import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";

/**
 * Route-level error boundary.
 *
 * A render crash inside one page must not white-screen the whole app. The
 * boundary wraps the routed content INSIDE the shell, so the header, the
 * language switcher and every other route stay usable; the fallback offers
 * "try again" (re-render the subtree from scratch) as well as a way back to
 * the start page. The raw message is disclosed behind the same "Details"
 * convention used elsewhere — useful when reporting a bug, never the only
 * thing on screen.
 *
 * The class component cannot call hooks, so the functional wrapper resolves
 * the strings through the i18n context and re-resolves them when the locale
 * changes.
 */

interface Strings {
  heading: string;
  body: string;
  retry: string;
  home: string;
  details: string;
}

interface BoundaryProps {
  children: ReactNode;
  strings: Strings;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only: the UI never renders a stack trace, but a reviewer opening
    // the console gets the real cause.
    console.error("[ClimateClaim] render error", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { strings } = this.props;
    return (
      <div className="alert alert-error" role="alert" data-testid="error-boundary">
        <strong>{strings.heading}</strong>
        <p>{strings.body}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
            {strings.retry}
          </button>
          <Link className="btn btn-secondary" to="/" onClick={() => this.setState({ error: null })}>
            {strings.home}
          </Link>
        </div>
        <details>
          <summary className="small">{strings.details}</summary>
          <p className="small mono" style={{ overflowWrap: "anywhere" }}>
            {error.message || String(error)}
          </p>
        </details>
      </div>
    );
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Boundary
      strings={{
        heading: t("errorBoundary.h"),
        body: t("errorBoundary.body"),
        retry: t("common.retry"),
        home: t("errorBoundary.home"),
        details: t("common.details"),
      }}
    >
      {children}
    </Boundary>
  );
}
