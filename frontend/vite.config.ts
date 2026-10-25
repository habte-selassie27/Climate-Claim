import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/** Repository root. Vite's own root is `frontend/`, but the `.env` lives above it. */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Public build-time configuration, sourced from the repository-root `.env`.
 *
 * SECURITY — why this is not just `envPrefix: "VITE_"`:
 *
 * The root `.env` holds BOTH public values (contract address, RPC URL, chain id)
 * and `VITE_DEPLOYER_PRIVATE_KEY`, a funded StudioNet deploy key. With the stock
 * `VITE_` prefix, Vite inlines every prefixed variable into the client bundle.
 * Measured behaviour (this repo, Vite 7): referencing `import.meta.env.X`
 * inlines only `X`, but a single `JSON.stringify(import.meta.env)` anywhere in
 * the source inlines ALL of them — silently publishing the deploy key.
 *
 * So the exposure is made structural rather than incidental:
 *
 *   1. `envPrefix` is narrowed to `VITE_PUBLIC_`, which matches no variable in
 *      `.env` today. Nothing from the root `.env` reaches `import.meta.env`, so
 *      even a whole-object reference cannot leak it.
 *   2. Each public value is injected explicitly via `define`, and only those.
 *      `VITE_DEPLOYER_PRIVATE_KEY` is never named in any `define` entry.
 *
 * A value only reaches the browser if it is added to PUBLIC_ENV_VARS below.
 */
const PUBLIC_ENV_VARS = [
  "VITE_CLIMATECLAIM_ADDRESS",
  "VITE_CLIMATEPOLICY_ADDRESS",
  "VITE_CLIMATEEVALUATOR_ADDRESS",
  "VITE_GENLAYER_RPC_URL",
  "VITE_GENLAYER_CHAIN_ID",
  "VITE_GLTEST_NETWORK",
] as const;

export default defineConfig(({ mode }) => {
  // Read every VITE_* var from the root .env, then hand-pick what gets injected.
  const env = loadEnv(mode, repoRoot, "VITE_");

  const define: Record<string, string> = {};
  for (const name of PUBLIC_ENV_VARS) {
    // Empty string when unset. `src/config/env.ts` treats "" as "use the typed
    // config fallback", so a missing or partial .env never breaks the build.
    define[`__ENV_${name}__`] = JSON.stringify(env[name] ?? "");
  }

  return {
    plugins: [react()],
    // Load .env from the repository root rather than frontend/.
    envDir: repoRoot,
    // See the SECURITY note above. Never widen this to "VITE_".
    envPrefix: "VITE_PUBLIC_",
    define,
    server: { port: 5173 },
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // The GenLayer SDK is the single largest dependency (~530 kB
            // minified). Isolating it keeps it out of the first-paint shell and
            // lets it be cached independently of app code.
            "genlayer-sdk": ["genlayer-js"],
            react: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
      // The isolated SDK chunk is ~531 kB minified, which trips the default
      // 500 kB advisory. The first-paint shell is ~184 kB, so this is expected
      // and scoped to the vendor chunk rather than a regression.
      chunkSizeWarningLimit: 600,
    },
  };
});