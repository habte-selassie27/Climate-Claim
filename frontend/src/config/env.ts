/**
 * Public build-time configuration, injected from the repository-root `.env`.
 *
 * The identifiers below are replaced at build time by the explicit `define`
 * entries in `vite.config.ts`. Only public values are injected; the deploy
 * private key in the root `.env` is never named in a `define` entry, so it
 * cannot reach the bundle. See the SECURITY note in `vite.config.ts` and
 * `.env.example`.
 *
 * (This file's comments ship to the browser inside the sourcemap, so they name
 * no env vars verbatim.)
 *
 * Every read is guarded with `typeof`. Under `vitest`, or any `tsc`-only pass,
 * the identifiers are NOT substituted, and a bare reference would throw a
 * ReferenceError. `typeof UNDECLARED` is safe and evaluates to "undefined".
 *
 * Every value is optional by design: an absent, empty or malformed variable
 * yields `null`/`""`, and the caller falls back to the typed config in
 * `network.ts` / `contracts.ts`. A missing `.env` degrades to the previously
 * hard-coded values instead of breaking the build.
 */

declare const __ENV_VITE_CLIMATECLAIM_ADDRESS__: string;
declare const __ENV_VITE_GENLAYER_RPC_URL__: string;
declare const __ENV_VITE_GENLAYER_CHAIN_ID__: string;
declare const __ENV_VITE_GLTEST_NETWORK__: string;

function read(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Contract address, or "" to use the typed fallback.
 *
 * Validated as 0x-prefixed 40-hex. Anything else is rejected rather than passed
 * through, because a malformed address would surface as an opaque RPC failure.
 */
export const ENV_CONTRACT_ADDRESS: string = (() => {
  const raw = read(
    typeof __ENV_VITE_CLIMATECLAIM_ADDRESS__ === "string"
      ? __ENV_VITE_CLIMATECLAIM_ADDRESS__
      : "",
  );
  return /^0x[0-9a-fA-F]{40}$/.test(raw) ? raw : "";
})();

/** RPC URL, or "" to use the typed fallback. */
export const ENV_RPC_URL: string = read(
  typeof __ENV_VITE_GENLAYER_RPC_URL__ === "string" ? __ENV_VITE_GENLAYER_RPC_URL__ : "",
);

/** Chain id, or null to use the typed fallback. Rejects non-integers and <= 0. */
export const ENV_CHAIN_ID: number | null = (() => {
  const raw = read(
    typeof __ENV_VITE_GENLAYER_CHAIN_ID__ === "string" ? __ENV_VITE_GENLAYER_CHAIN_ID__ : "",
  );
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
})();

/**
 * Requested network key, or "" to use the typed fallback.
 *
 * Not validated here: the caller owns the set of valid keys (NETWORKS), so the
 * check belongs there. See `ACTIVE_NETWORK` in `network.ts`.
 */
export const ENV_NETWORK_KEY: string = read(
  typeof __ENV_VITE_GLTEST_NETWORK__ === "string" ? __ENV_VITE_GLTEST_NETWORK__ : "",
);