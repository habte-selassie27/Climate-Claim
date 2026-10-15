import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

/**
 * Provider order matters only in that both must sit ABOVE <App>: every page and
 * component reads the locale for copy and the theme for `data-theme`. They are
 * independent of each other, so the order between them is arbitrary.
 *
 * The no-flash theme script in index.html has already set `data-theme` before
 * this runs; ThemeProvider simply keeps it in sync afterwards.
 */
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);