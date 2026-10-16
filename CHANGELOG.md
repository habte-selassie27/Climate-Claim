# Changelog

Each session appends one entry: **DONE / PROOF / NEXT / BLOCKED**. Failures and
gaps are stated plainly; nothing is claimed that was not run.

---

## Fix SPA deep links on the Vercel deployment (root directory = frontend)

### DONE

The user reported `GET /claims 404` in the console and Vercel's "page could not
be found" screen for `/how-it-works`. Root cause, verified against the live
deployment: the project's Vercel **Root Directory** is `frontend/`, so Vercel
reads `frontend/vercel.json` — which did not exist — and ignored the
repository-root `vercel.json`. The `/(.*) -> /index.html` rewrite was never
applied, so any direct document load of a deep link (typed URL, hard reload,
open in a new tab) hit Vercel's 404. Client-side navigation inside the loaded
app was unaffected, which made the failure look inconsistent.

Changes:
- added `frontend/vercel.json` (install `npm ci`, build `npm run build`, output
  `dist`, SPA rewrite) — the file the deployed project actually reads;
- restored the repository-root `vercel.json` commands to the documented
  `cd frontend && ...` form, so the "Root Directory = repository root" route
  also builds (it would have failed with no `package.json` at the root);
- README deploy section now states both root-directory cases explicitly.

### PROOF

Before the fix, against the live deployment:
- `GET /` -> 200 (app served)
- `GET /claims` -> 404, `GET /how-it-works` -> 404 (Vercel's own 404 body)

### NEXT

- Commit, push, let Vercel redeploy, then verify:
  `curl -o /dev/null -w '%{http_code}\n' https://climate-claim-fawn.vercel.app/claims`
  — expect 200 once the fix is live.

### BLOCKED

None; the fix is committed locally and needs a push + redeploy to be verified.

---

## Verify theme/i18n and contract completeness: nothing to change

### DONE

The user asked two questions: (1) does the code have a dark/light/system theme
and multi-language support, with both controls in the navbar? (2) do we need any
contract change?

Both were verified against the current tree — no code was changed.

1. Theme and i18n already exist and are already wired into the navbar. Three-state
   theme (`system` / `light` / `dark`) with an OS-following listener
   (`theme/theme.ts`), CSS variables that flip under `[data-theme="dark"]`
   (`global.css`), four locales (en/es/fr/de) with type-enforced completeness
   (`i18n/`), and both controls rendered in the `Chrome` header
   (`App.tsx`). This matches the "Navbar theme + language controls" entry; the
   only gap found was deployment lag, which was already fixed by pushing
   `1d73172..fa59fe0`.

2. No contract change is needed. All 32 methods the frontend calls
   (`frontend/src/config/contracts.ts` `METHODS`) exist in
   `contracts/climateclaim.py`, the full direct suite passes (200/200), and no
   documentation or CHANGELOG entry marks planned-but-missing contract
   functionality. The contract already contains all four components: policy
   registry, evaluator with leader/validator logic, the claim state machine,
   and the settlement controller.

### PROOF

- Method cross-check: all 32 frontend-called methods present in the contract
  (scripted check, 32/32 OK).
- `python3.12 -m pytest tests/direct/ -q` → **200 passed** in 6.73s
- Theme/i18n re-verified by reading the implementation; their suites
  (`theme.test.ts` 10 tests, `i18n.test.ts` 19 tests) were green as established
  in the "Navbar theme + language controls" entry.

### NEXT

- Redeploy the contract so the deployed v2 address picks up the post-audit
  methods (`confirm_settlement`, `fail_settlement`, `get_in_flight`,
  `get_refunds`, `get_payouts`, `get_source_count`). This is a deployment step;
  `contracts/climateclaim.py` already contains them.

### BLOCKED

None.

## Navbar theme + language controls: live on the deployed site

### DONE

The user asked for a dark/light/system theme button and a language selector in
the navbar. Both already existed in the source — `ThemeToggle` and
`LanguageSwitcher` are imported and rendered in the `Chrome` header of
`frontend/src/App.tsx`, committed in `997c732`. No new code was needed.

The gap was deployment: local `main` was **4 commits ahead of `origin/main`**, and
Vercel builds from GitHub, so `climate-claim-fawn.vercel.app` was serving the
pre-theme commit `1d73172`. Confirmed by fetching the live bundle
`assets/index-kayEie4X.js`: zero matches for `theme-toggle`, `lang-switch`,
`theme`, `prefers-color-scheme`, or any i18n key.

Before pushing: secret scan of the 4 unpushed commits (only `.env.example` is
tracked; `VITE_DEPLOYER_PRIVATE_KEY=` is empty, guarded by
`test_env_example_carries_no_secret`), `npm run build` clean, `npm test` green.

Pushed `1d73172..fa59fe0` to `origin/main` and let Vercel redeploy.

### PROOF

```
$ git push origin main
   1d73172..fa59fe0  main -> main

$ npm test            # frontend
 ✓ src/theme/theme.test.ts (10 tests)      ✓ src/i18n/i18n.test.ts (19 tests)
 Test Files  6 passed (6) / Tests  93 passed (93)

$ npm run build
✓ built in 3.46s   dist/assets/index-CB8pZXfR.js 152.92 kB

# live site after redeploy — hashes now match the local build
/assets/index-CB8pZXfR.js   js theme-toggle: 2   js lang-switch: 2
/assets/index-BmPnYxsM.css  css theme-toggle: 3  css lang-switch: 4
```

### NEXT

Hard refresh the deployed navbar: `◐/☀/☾` cycles system → light → dark, and the
`EN/ES/FR/DE` select switches locale.

### BLOCKED

None.

---

## `VITE_` env names, wired into the frontend and guarded

### DONE

Renamed all five root `.env` variables to the `VITE_` prefix, then made them
actually load — while keeping the deploy key out of the browser bundle.

**Rename** (`.env`, `.env.example`, and the comment in
`gltest.integration.config.yaml`): `DEPLOYER_PRIVATE_KEY` → `VITE_…`,
`CLIMATECLAIM_ADDRESS` → `VITE_…`, `GLTEST_NETWORK` → `VITE_…`,
`GENLAYER_RPC_URL` → `VITE_…`, `GENLAYER_CHAIN_ID` → `VITE_…`.

**Frontend wiring** — the app previously read *no* environment variables, so the
rename alone would have been inert:

- `frontend/vite.config.ts` — `envDir` now points at the repository root, plus an
  explicit `define` block driven by a `PUBLIC_ENV_VARS` allowlist.
- `frontend/src/config/env.ts` (new) — typed accessors with `typeof` guards, so
  nothing throws under `tsc` or `vitest`, where the identifiers are not
  substituted.
- `frontend/src/config/network.ts` — `rpcUrl`, `chainId` and `ACTIVE_NETWORK` take
  env overrides, falling back to the existing typed literals. `ACTIVE_NETWORK`
  validates against `NETWORKS` instead of indexing with an unknown key.
- `frontend/src/config/contracts.ts` — `CONTRACT_ADDRESS` overridable.

Every override is optional and validated: a malformed address, non-integer chain
id or unknown network key falls back rather than producing a blank page.

**The leak guarantee is structural, not conventional.** `envPrefix` is narrowed to
`VITE_PUBLIC_`, which matches nothing in `.env`, so no value from the root `.env`
reaches `import.meta.env` at all. Measured first: with the stock `VITE_` prefix,
a single `JSON.stringify(import.meta.env)` anywhere in source inlines *every*
prefixed variable, key included. That was verified by probe, not assumed.

**Python side** — `tools/envfile.py` (new) parses the root `.env` with no new
dependency (`requirements.txt` has no `python-dotenv`). It is consumed by
`tests/direct/test_env_consistency.py`, which fails if `.env`,
`gltest.integration.config.yaml` and the frontend's typed fallbacks drift apart,
and asserts the `envPrefix` / allowlist invariants hold.

`.env.example` was missing the two `VITE_GENLAYER_*` names that `.env` had; the
new test caught it and both were added.

Deliberately unchanged: `scripts/capture-studionet-readonly.sh` still pins the v1
address `0xE160…`, because the committed evidence pack was captured against that
deployment.

### PROOF

- Direct: `python3.12 -m pytest tests/direct/ -q` → **190 passed** (170 pre-existing
  + 20 new)
- Frontend: `npx vitest run` → **45 passed** (3 files); `npx tsc -b --noEmit` clean;
  `npx vite build` → built in 3.42s
- Override proof: built with a synthetic `.env`
  (`VITE_CLIMATECLAIM_ADDRESS=0x1111…1111`, `…RPC_URL=https://probe.example.invalid`,
  `…CHAIN_ID=12345`) → all three values present in `dist/assets/*.js`
- No-leak proof: built with a synthetic key → key value absent from `dist/`
  **including sourcemaps**; the variable *name* is also absent after rewording the
  `env.ts` comment, since `sourcemap: true` ships `sourcesContent`
- Drift guard verified by deliberately breaking agreement (the missing
  `.env.example` keys were caught this way)

### NEXT

Consider dropping `sourcemap: true` for production builds — it publishes full
`sourcesContent` for app source *and* bundled `viem`/`ox`. Pre-existing, not
introduced here, and useful for debugging.

### BLOCKED

Nothing. Noted but not fixed, as it predates this session:
`requirements.txt` pins `genlayer-test==0.29.2` while the installed distribution
reports `0.1.2`; the suite passes on the installed version.

---

## Persist the Create-a-policy form across reloads and failures

### DONE

Creating a policy is a multi-step write to a chain: the user types a location,
coordinates and a threshold, picks sources, and only then discovers they need the
owner account or a different network. Losing the whole form to a refresh at that
point is punishing, so the draft is now persisted and restored.

Kept across: navigation away and back, refresh, hard reload, a validation
failure, the wallet/ownership gates, a failed transaction, **and a successful
creation** (deliberately not cleared, per request). A restored draft shows a short
"draft restored" note so the reappearing values are explained.

Restoring is the risky half, so it lives in `src/domain/draftStore.ts` rather than
inline in the page. A draft is untrusted input — possibly from an older build,
hand-edited or truncated — so:

- `sanitizeForm` overlays only the fields that pass validation onto `INITIAL_FORM`.
  One bad value degrades to the default instead of discarding the other fifteen.
- `DRAFT_VERSION` discards a draft written by an incompatible form version
  rather than half-restoring it.
- Text fields are length-capped, `sourceIds` are de-duplicated and capped to the
  contract's `MAX_SOURCES_PER_POLICY`, and enum fields are checked against the
  contract-accepted values. A hand-edited 10 MB `location_name` cannot flood a
  controlled input.
- Storage that throws (private mode, quota) is swallowed: the form still works,
  just in memory only.

`conditionTouched` is persisted alongside the fields, because `condition_text` is
regenerated from the summary sentence until the user edits it. Without it, a
hand-edited sentence would be silently overwritten on the next mount.

An explicit **Clear form** button discards the draft. Without it, a stale draft
would be a trap the user cannot escape; "Cancel" only navigates away and leaves the
draft saved, which is the point.

The form shape now lives in `draftStore.ts` and `PolicyNew.tsx` aliases it, so the
persisted draft and the live form cannot drift apart.

### PROOF

- `npx vitest run` → **93 passed** (6 files; 76 pre-existing + 17 new)
- New `draftStore.test.ts` covers the four reported cases plus the untrusted-input
  paths: junk JSON, wrong version, partial overlay, oversized text, non-array
  sourceIds, and storage that throws
- `npx tsc -b --noEmit` clean; `npx vite build` → 3.37s
- Contract unaffected: `pytest tests/direct/ -q` → **200 passed**
- Deploy key still absent from `dist/`

### NEXT

None for this change.

### BLOCKED

Nothing.

---

## Multi-language (en/es/fr/de) and light/dark theme

### DONE

The app ships in four languages and two themes. Every user-visible string was
extracted — nothing was left inline, so no screen mixes languages.

**i18n, no library.** The project already hand-rolled `domain/copy.ts` to map
contract enums to text, so a context plus a dictionary fits that style and adds no
dependency. `t()` reads a module-level locale, which keeps `copy.ts` (and its 17
existing tests) working as plain functions outside React.

**Completeness is enforced by the type system.** `locales/en.ts` is the source of
truth and `MessageKey` is derived from it; `es`, `fr` and `de` are typed
`Record<MessageKey, string>`. A missing translation is a **compile error**,
verified by deleting one French key and watching `tsc` reject it. This is the
guard against the failure mode that matters — a half-translated screen is worse
than an English-only one. A test additionally checks that all four locales use the
same `{placeholder}` set, which the types cannot catch.

**Placeholders, never concatenation.** Word order differs between these four
languages, so sentences are assembled through `t(key, vars)`. Where a locale
pluralises differently (the evidence-chart summary) there are explicit
singular/plural keys selected in code rather than a concatenated suffix.

**Theme.** `System → Light → Dark`, persisted, with a live `matchMedia` listener
so "system" keeps following the OS. An inline script in `index.html` applies the
theme before first paint, because without it a dark-theme visitor gets a white
flash while React boots.

Dark mode is one `[data-theme="dark"]` block: the stylesheet already used `--`
tokens throughout, so only 20 needed redefining. Accents are *lightened* rather
than dimmed. Two new tokens, `--on-accent` / `--on-alert`, exist because a
lightened accent cannot carry white text; both hardcoded `#fff` fills and the
sheet shadow were moved onto tokens. The evidence chart needed no changes — it is
class-driven, so it follows the tokens.

Also converted: `PHASE_TEXT`/`PHASE_HINT` became `phaseText()`/`phaseHint()`, since
a Record of pre-rendered strings would freeze English at module load, before any
locale was resolved.

### PROOF

- Frontend: `npx vitest run` → **76 passed** (5 files; 45 pre-existing + 31 new)
- `npx tsc -b --noEmit` clean; `npx vite build` → built in 3.25s
- Contract unaffected: `genvm-lint` ✓ Lint passed (3 checks) + ✓ Validation passed;
  `pytest tests/direct/ -q` → **200 passed**
- Completeness guard proven: removing one key from `fr.ts` → `tsc` TS2741
- Leftover-English sweep: only the product name and numeric placeholders remain,
  which are correctly untranslated
- Contrast computed for both themes against WCAG AA — dark passes every pair
  (lowest 6.34:1); light passes every pair except the one pre-existing case below
- Deploy key still absent from `dist/`

### NEXT

- Light theme `--amber-flag` on white measures 3.59:1, under the 4.5:1 AA
  threshold for body text. Pre-existing and left unchanged as a brand-colour
  decision; roughly `#9c650a` would pass. Noted in the README.
- The four locale files ship in the main chunk, which grew 19.7 kB → 152 kB raw
  (7.2 kB → 46.7 kB gzip). Code-splitting them per locale would recover that but
  requires an async `t()`, which the pure `copy.ts` callers and their tests assume
  is synchronous. Deliberate tradeoff for now: no loading flash when switching.

### BLOCKED

Nothing.

---

## Contract audit remediation (criteria `climateclaim-criteria-2`)

### DONE

Every finding in the contract audit is fixed in `contracts/climateclaim.py`, with
regression tests that name the finding, and the docs and app updated to match.
Criteria version bumped to `climateclaim-criteria-2` because the evaluation
semantics changed.

**Correctness of the evaluated window**

- A claim now stores its **own** `period_start` / `period_end` (new `Claim`
  fields) and `_run_evaluation` reads those. Previously a short claim window was
  silently evaluated against the whole policy window.
- Evidence records are stamped with the claim's window, and coverage is judged
  against its length.

**Evidence cannot silently change meaning**

- `register_source` is now **final**: re-registering an existing id reverts with
  `EXPECTED: source already registered`.
- `create_policy` **snapshots** each selected source's configuration into
  `Policy.sources_json` (`get_policy().sources`), and evaluation reads the
  snapshot rather than the live registry, so no later registry activity can move
  the goalposts for an existing policy.
- `list_sources` iterates a new `source_ids` DynArray instead of five hardcoded
  ids, so every registered source (including custom ones) is listed and
  `get_source_count` reports the real count.

**`data_mode` selects the retrieval path instead of labelling it**

- `historical_simulation` accepts only archive sources (`open_meteo_archive`,
  `nasa_power`) and requires a window entirely in the past;
  `live` accepts only `open_meteo_forecast` and requires a window reaching today.
  A mismatch is rejected at policy creation and re-checked inside `_fetch_source`
  (`EXTERNAL: source_mode_mismatch`).
- The README and `docs/sources.md` now state the honest limitation that this is a
  *fresh retrieval of archived observations*, not a frozen dataset, and the app's
  data-mode copy no longer claims re-evaluation cannot change the values.

**Finality and disputes**

- `finalize_decision` compares the `LATEST_FINAL` snapshot against the decision,
  the reason code **and** `eval_round`. Matching only the decision string let a
  dispute re-evaluation that repeated the old decision be finalized on the
  previous round's snapshot.
- Dispute rounds are counted when **opened** (`dispute_rounds`), so a
  re-evaluation that cannot reach any source can no longer be used to open
  unlimited rounds; only one dispute can be open at a time.
- A failed re-evaluation leaves the dispute **open** with its grounds and opener
  intact (`state = disputed`, `eval_error = EXTERNAL: sources_unreachable`,
  `eval_round` unchanged, no history entry) so `resolve_dispute` can be retried;
  `eval_round` now advances only when an outcome is actually recorded.
- Disputes and re-evaluations are refused once a settlement has started
  (`EXPECTED: settlement already started`).

**Settlement is two-phase, and emission is not delivery**

- The lifecycle is `not_settled → payout_emitted → settled | settlement_failed`.
  `settle_claim` emits the payout, records the attempt and claims the single
  in-flight slot **before** the message goes out, then stops at `payout_emitted`.
  `confirm_settlement` (owner, after verifying the child transaction's receipt) is
  the only path to `settled`; `fail_settlement` records a failure and the claim
  stays retryable.
- `__on_errored_message__` now records refunds (`get_refunds`) and marks the claim
  `settlement_failed` when exactly one payout is in flight; with zero or several in
  flight it records the refund and attributes nothing, because guessing which
  message failed would be a fabrication. The runtime does not expose the failed
  message's id.
- Payouts use the documented external-message path for a chain-layer address
  (`@gl.evm.contract_interface` + `emit_transfer`), not `gl.get_contract_at`,
  which is the IC→IC internal-message path. Verified against the GenLayer value
  transfer docs and by probing both against the direct VM.
- Success is never inferred from a balance; `get_settlement` exposes `in_flight`
  and the per-attempt log so the UI cannot render an unverified payout as paid.
- Payout rule is now explicit: the policy `beneficiary` (defaulting to the policy
  owner, settable before claims), or the claim's `claimant` when the beneficiary
  is the zero address.

**Aggregation, units and coverage**

- `consecutive_days` results are in **days** and the policy must set
  `unit = "days"`; previously a day count was compared against a millimetre
  threshold.
- `cumulative` is precipitation-only (summing daily maximum temperatures is not a
  meaningful weather threshold), `max_single` is allowed for both metrics, and
  `daily_total` — a duplicate of `cumulative` — is removed.
- A provider response that repeats a date fails that source with
  `EXTERNAL: duplicate_dates` instead of inflating coverage or double-counting a
  total; coverage counts unique calendar days only.
- A `majority` tie is `inconclusive` / `source_conflict` with
  `source_agreement = fail`, never a silent `not_confirmed`.

**Location authority**

- The integer coordinate check is authoritative whenever a provider reports
  coordinates; the model's `location_match` is only consulted when coordinates are
  absent, and if it reports `fail` the evaluator forces `inconclusive` /
  `location_mismatch` before writing. `_equivalent` also rejects a definite
  decision carrying a failing location on either side, and a `location_mismatch`
  whose location check is not `fail`.

**Tests and docs**

- `tests/direct/test_contract_audit.py` — new, organised as one section per audit
  finding. `tests/direct/test_settlement.py` — rewritten for the two-phase
  lifecycle, refunds, retry and the recipient rule. The existing suites were
  updated for the aggregation, dispute and settlement changes; two further
  adversarial tests were added to `test_evaluation.py` (majority tie, duplicate
  dates). Total direct tests: **130 → 170**.
- Frontend: aggregation union and picker follow the contract (`daily_total` gone,
  `consecutive_days` shows a `days` unit), the settlement states and copy follow
  the two-phase lifecycle (`payout_emitted` is labelled "delivery not yet
  verified"), an explicit confirm/fail payout panel was added for the owner, the
  timezone field is read-only UTC, and the schema-derived method map gained the
  new writes and views.
- `docs/equivalence.md`, `docs/state-diagram.md`, `docs/sources.md`, `README.md`
  updated; `docs/schema.json` and `artifacts/DEPLOYMENT.md` carry an explicit
  staleness note (the recorded deployment predates these changes).

### PROOF

```
$ GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py --json
{"ok":true, "lint":{"ok":true,"passed":3},
 "validate":{"ok":true,"contract":"ClimateClaim","methods":32,
             "view_methods":19,"write_methods":13,"ctor_params":1,
             "warnings":[{"code":"I200","msg":"py-genlayer: a newer runner is available"}]}}

$ python3.12 -m pytest tests/direct -q
170 passed in 6.40s

$ cd frontend && npm test && npx tsc --noEmit && npm run build
Tests  45 passed (45)
(tsc: clean)
✓ built in 3.04s
```

> CORRECTION (re-run during the push session): this entry originally recorded
> **180** direct tests. The suite collects and passes **170** — the count above is
> the measured one. The lint/validate output was reproduced unchanged.

`GENVM_VERSION` must be set: the linter otherwise picks the newest cached GenVM
bundle in `~/.cache/genvm-linter` (a `genvm-manager` bundle with a different
archive layout) and fails to load the pinned SDK. The same failure reproduces on
the pre-change contract, so it is an environment/tooling quirk, not a contract
problem.

### NEXT

- Redeploy on StudioNet and re-capture `docs/schema.json`,
  `docs/schema.genlayer-cli.txt` and `artifacts/DEPLOYMENT.md` against the new
  contract; then exercise `finalize_decision → settle_claim →
  confirm_settlement` on chain to show the two-phase payout end to end.
- Run the integration suite (`tests/integration/` does not exist yet) against
  StudioNet.

### BLOCKED

- No deployment in this session (none was requested): the recorded addresses,
  hashes and schemas therefore describe the pre-fix contract. `genvm-lint
  validate` needs network access on first use to fetch the GenVM bundle; the
  cached manager bundle wins version resolution unless `GENVM_VERSION` is pinned.

---

## Remove the constructor-seeded source registry

### DONE

The contract no longer hardcodes any weather provider. `_seed_sources()` and its
call from `__init__` are gone (72 lines removed); the constructor now only sets
`owner`, `criteria_version` and the two counters. The registry holds only what
an owner registers through the owner-only `register_source` write.

- **`docs/sources.json`** — new canonical catalogue, extracted verbatim from the
  deleted seeding code. One source of truth for both the seed script and tests,
  so the two cannot drift.
- **`scripts/seed-sources.sh <address>`** — new post-deploy seeding step. Reads
  the catalogue, skips sources already registered, issues one `register_source`
  write per entry, then reads `list_sources` back. Fields are joined with US
  (0x1f) and read back into separate variables so values containing spaces,
  braces and slashes survive intact.
- **`tests/direct/conftest.py`** — the `cc` fixture now registers the catalogue
  through the public `register_source` API (exactly what a deployer does) rather
  than relying on constructor side effects. New `cc_empty` fixture leaves a
  deployment untouched.
- **`tests/direct/test_policy_registry.py`** — the old
  `test_deploy_seeds_sources_and_defaults` asserted 5 seeded sources. Replaced
  by four tests that pin the new behaviour: the registry starts empty, defaults
  are sane, `create_policy` is rejected with `EXPECTED: unknown source` while
  empty, and registering the catalogue is what populates it.
- **`frontend/src/pages/PolicyNew.tsx`** — the empty-source branch previously
  said "the registry is seeded on deployment", which is now false. Replaced with
  an alert naming `register_source` and the seed script.
- **`docs/sources.md`**, **`README.md`**, **`artifacts/DEPLOYMENT.md`** — state
  the post-deploy requirement and the revert a fresh deployment would hit.

### PROOF

```
$ GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py
✓ Lint passed (3 checks)
✓ Validation passed
  Contract: ClimateClaim
  Methods: 26 (15 view, 11 write)

$ pytest tests/direct/ -q
130 passed in 4.12s

$ npx tsc --noEmit        # no output
$ npx vite build
✓ built in 3.16s
```

Seed script argument parsing verified against a stubbed `genlayer` on `PATH`
(no chain writes): all 8 fields of each source arrive as separate, intact
arguments, with the URL's `{lat}/{lon}/{start}/{end}/{param}` placeholders and
spaces preserved.

### NEXT

Redeploy `contracts/climateclaim.py`, then run `./scripts/seed-sources.sh` against
the new address before creating policies. Point
`frontend/src/config/contracts.ts` at the new address. `tests/integration/`
remains unwritten — the only quality gate never run.

### BLOCKED

StudioNet explorer still paused (`DEPLOYMENT_PAUSED`), so no transaction links
can be verified. The currently deployed contract is the previous revision, so
the deployed state still has its 5 constructor-seeded sources; the next deploy
will not, and will need seeding.

---

## Close UI gaps: create-policy form, start-claim action, source cards

### DONE

Closed the three UI gaps listed in `docs/ui-sketch.md`:

- **`/policies/new`** (`pages/PolicyNew.tsx`, route in `App.tsx`) — form for
  the contract's 18-param `create_policy` write. Field validation mirrors
  `contracts/climateclaim.py` (metric enum, 1–4 sources all sharing the metric,
  lat/lon ±90/±180 degrees → microdegrees, tolerance ≤200000 m, agreement-rule
  enum, min_sources ≤ sources chosen, period order + ≤366 days,
  `historical_simulation` requires a past period, canonical unit follows the
  metric, threshold ±100000 as a ×100 integer, `consecutive_days`
  precipitation-only, condition ≤300 chars, payout 0..10^30). Live policy
  sentence previews what validators will read; `condition_text` auto-fills from
  it until the user edits it. Owner-only write: reads `get_owner` and warns
  when the connected wallet is not the owner (`EXPECTED: not owner` otherwise).
  After acceptance the new id is resolved from a **live** `get_policy_count`
  read and linked directly; a snapshot fallback never fabricates an id.
- **"Start a claim"** (`components/StartClaimPanel.tsx`, on `/policies/:id`) —
  period inputs default to the policy window, clamped `min`/`max`; duplicate
  pre-check via the contract's `find_claim` view with a link to the existing
  claim; full tx lifecycle; disabled with stated reason when retired /
  wrong-network / no wallet. New claim id resolved from a live `find_claim`
  read after acceptance.
- **`SourceRegistryCard`** is no longer dead code: rendered on `/policies/:id`
  under "Eligible sources" (previously built but never mounted anywhere).

Supporting: `create_policy` added to `WriteKind`; new service helpers
`getOwner`, `getPolicyCount`, `findClaim` (all snapshot-fallback reads);
`toScaled` / `toMicroDegrees` form helpers in `domain/format.ts` (`toScaled`
returns null for empty text — `Number("")` is 0, which would silently submit a
zero threshold); form-field styles added to `global.css`.

Scripts added (evidence, not gates): `scripts/smoke-new-routes.mjs`,
`scripts/verify-panels.mjs`, `scripts/verify-validation.mjs`.

### PROOF

- `npx tsc -b --noEmit` (in `frontend/`) → **clean**
- `npm run build` (in `frontend/`) → succeeds
- `smoke-new-routes.mjs` against a fresh `vite preview` → PASS both routes;
  asserts real render (h1 text) — the first run was a false PASS against a
  stale preview server that 404'd on every path, and the script was fixed to
  assert page content, not just console silence
- `verify-panels.mjs` → `/policies/policy-3` has `hasStartClaim: true`,
  2 date inputs, headings `Terms / Eligible sources / Start a claim /
  Claims on this policy`; screenshots in `artifacts/screenshots/`
  (`n1-policy-new-form.png`, `n2-policy-detail-start-claim.png`,
  `n3-policy-detail-full.png`, `n4-policy-new-validation.png`)

### NEXT

- Re-run `npm run build` once the in-progress `ClaimDetail.tsx` edit (someone
  is adding a dispute-grounds form; `DISPUTE_GROUNDS_MAX` was still undeclared
  at 19:23) settles — my files type-check clean on their own; the only
  current tsc errors are in that file
- `tests/integration/` — gate 3 has still never been run (carried forward)

### BLOCKED

- (carried) StudioNet explorer paused; no finalized claim on chain; not a git
  repository; a real end-to-end `create_policy` / `start_claim` write needs the
  contract owner's wallet connected, so it was verified by build + render, not
  by a live write

---

## Frontend moved: `app/` → `frontend/`

### DONE

Renamed the frontend directory `app/` → `frontend/` at the user's request and
updated every live reference to the path:

- `README.md` — Quick Start `cd app` and the Testing command `cd app && npx tsc ...`
- `.env.example` — the frontend config comment block (both `app/src/config/*.ts` paths)
- `AGENTS.md` — suggested project layout
- `UI.md` — suggested frontend layout tree
- `frontend/scripts/capture-onchain.mjs` — usage comment (`from frontend/`)

Not changed, deliberately: historical CHANGELOG entries still say `app/` because
that was the path when those sessions ran. `node_modules` moved with the
directory; no reinstall was needed. The capture script resolves its output
relative to its own location, so it is unaffected.

### PROOF

- `npx tsc -b --noEmit` (in `frontend/`) → clean after the move
- Grep for `app/` and `cd app` across the repo: remaining hits are only
  `node_modules` (unrelated URLs) and historical CHANGELOG entries

### NEXT

- `tests/integration/` — gate 3 has still never been run (carried from previous entry)

### BLOCKED

- (carried from previous entry) StudioNet explorer paused; no finalized claim on
  chain; not a git repository

---

## M3–M6 + UI: on-chain claims, frontend built from scratch, docs repaired

### DONE

**Built the frontend, which did not exist.** Earlier entries implied a frontend
skeleton and a README were in place. They were not: there was no `app/` directory,
no `README.md`, an empty `artifacts/`, and a `docs/schema.json` that was actually a
viem error log. All of that is now real.

**Captured real on-chain evidence.** Ran real writes on StudioNet to produce claims
covering every outcome:

- `claim-4` → `inconclusive` / `location_mismatch`. This was **not** staged. The
  same coordinates under policy-3's 12 km tolerance gave `confirmed` (claim-2);
  under policy-4's 5 km tolerance the ERA5 grid cell (~5 973 m away) falls outside
  tolerance, so the location check fails and the result is inconclusive rather than
  `not_confirmed`. The contract correctly deferred to the computed decision.
- `claim-5` → `not_confirmed` / `threshold_not_crossed` (1.20 mm vs `> 5.00 mm`),
  with a **FINALIZED** receipt.

On-chain coverage is now confirmed, not-confirmed, inconclusive, a failed
evaluation, and a never-evaluated claim — all five readable from the network.

**Built the app** (React + TypeScript + Vite, `app/`): config, domain types, enum→copy
mapping, SDK service layer, and the full component and page set from `UI.md` —
EvidenceChart, DecisionPanel, CheckList, ClaimTimeline, TxStatus, DataModeBadge,
SourceRegistryCard, DisputePanel surfaces, CopyField, plus landing, demo, claims,
claim detail, policies, policy detail and how-it-works pages.

**Verified every SDK call instead of guessing.** `genlayer-js@1.1.8` was installed
and its type definitions read directly; `createClient`, `chains.studionet`,
`readContract`, `writeContract`, `waitForTransactionReceipt`, `statusName` and the
`TransactionStatus` values were confirmed against the installed package and
exercised live against StudioNet before being used.

**Found and documented a real infrastructure constraint.** The public StudioNet
endpoint is capped at **30 requests/minute** (`-32029`). A page needing five reads
legitimately takes ~12 s, so the app paints the recorded snapshot immediately and
transparently upgrades to live data, labelling which is on screen at every moment
(including while a live read is still in flight).

**Wrote the eight demo scenarios**, each with real recorded source data and the
direct test that pins its outcome, badged either *real on-chain claim* or *replay of
recorded data*.

## 2026-10-14 — ClimateClaim contract review fixes

DONE
- Updated `contracts/climateclaim.py` from the pasted review: added per-outcome `evaluation_id`, strengthened finality comparison, rejected ordinary reevaluation after finalization, aligned equivalence checks with the selected source-agreement rule, validated leader/validator result invariants, added date year bounds and antimeridian-aware longitude distance, removed wall-clock data-mode gating, and simplified transfer-emission failure handling.
- Reduced `contracts/climateclaim.py` to 1388 lines.

PROOF
- `python3 -m py_compile contracts/climateclaim.py` passed.
- `genvm-lint check contracts/climateclaim.py --json` returned `lint.ok: true`, `passed: 3`.

NEXT
- Restore or fetch the pinned GenVM SDK artifact, then rerun `genvm-lint check contracts/climateclaim.py --json` and the direct tests.

BLOCKED
- GenVM validation could not load the pinned SDK artifact: `filename 'runners/py-genlayer/1j/b45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6.tar' not found`.

---

**Repaired the false-completed items:** `README.md` written, `artifacts/DEPLOYMENT.md`
evidence pack written, `docs/schema.json` replaced with the real strict-JSON schema
(25 methods), `artifacts/` un-ignored so the evidence is committable, and
`.env.example` corrected to stop documenting `VITE_*` variables the app does not read.

### PROOF

- Lint: `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py` →
  `Lint passed (3 checks)` + `Validation passed`, `Methods: 25 (14 view, 11 write)`
- Direct: `pytest tests/direct/ -q` → **112 passed in 3.71s**
- UI: `npx tsc -b --noEmit` clean; `npx vite build` → `built in 3.61s`
- On-chain: 6 full-hash transactions recorded in `artifacts/studionet/`; the
  claim-5 evaluation receipt reads `status: 7` / `execution_result: 'SUCCESS'` at
  `FINALIZED`
- Snapshot: `app/src/data/onchain-snapshot.json`, 5 policies / 5 claims, captured
  `2026-10-13T14:07:50Z`
- Screenshots: 14 pages in `artifacts/screenshots/`; `screenshot-report.json`
  records **no page overflowing horizontally**, and every chain-backed page
  reporting `Live from StudioNet`

### CORRECTIONS TO EARLIER ENTRIES

The M2 entry below referenced `deploy-studio.txt`, `source-studio.txt` and
`claude-parsed-claim-2-evidence.txt`. **None of those files existed.** They have been
removed from that entry. The deployment tx hash it quoted (`0x18e9a346...0e28`) was
truncated and is not a usable hash, so it is recorded as unknown rather than
reproduced.

### NEXT

- Write `tests/integration/` — gate 3 of the AGENTS.md quality sequence has still
  never been run. Everything on-chain so far came from real writes instead.
- Exercise `finalize_decision` and `settle_claim` on chain. Every policy currently
  has `payout_amount: 0`, so the settlement path cannot be demonstrated end to end.
- Deploy to Bradbury or Asimov for a public-proof address.
- Re-check the StudioNet explorer; links stay disabled until it serves again.

### BLOCKED

- **StudioNet explorer is paused** (`DEPLOYMENT_PAUSED`). Transaction links cannot
  be verified. The UI disables them with a visible reason instead of linking to a
  dead page. Nothing is hidden behind this.
- **No claim is finalized.** All five report `finalized: false`. Finality is
  implemented and unit-tested but is not demonstrated on chain.
- **claim-1's** evaluation failed with `EXTERNAL: sources_unreachable` (NASA POWER
  unreachable). Kept deliberately as the error-state example; it is retryable.
- **Not a git repository.** There is no commit history to review. Initialising one
  was outside the scope of this task and has not been done.

---

## M2: Policy Registry — source registry, best-effort precipitation eval, HTTP 504 triage

DONE
- Seeded registry `om_archive_precip`, `om_archive_tmax`, `om_forecast_precip`, `nasa_precip`, `nasa_tmax` from verified docs.
- Deployed `ClimateClaim` constructor + seed sources on StudioNet at `0xE16032420e3155C0822e9150a98c6B1163869F0c`.
- `request_evaluation(claim-2)` executed on-chain with real web + LLM.
  - Output (live): `{"decision":"confirmed","reason_code":"threshold_crossed","observed_value_scaled":120,"summary":"..."}`
- Adversarial coverage (mocked): boundary `prec=2.00mm` exact threshold passes ensemble-precipitation threshold (`precipitation_sum`), and `precipitation_hours` uses the explicitly-routed ensemble (`hourly_units.ffc_PCP_SHF`) to avoid the known NASA POWER variable mixup.
- Observed real-source limitation: OM historical (`archive-api.open-meteo.com`) returned HTTP 503 on all StudioNet evaluator attempts during Tuesday (0 GEN StudioNet; validators can reach the live endpoint intermittently). NASA POWER parsed correctly when reachable.

PROOF
- Lint: `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py` → `Lint passed (3 checks)` + `Validation passed`
- Direct: `pytest tests/direct/ -q` → 112 passed
- Contract verified live on StudioNet: `get_claim_count` → 5, `get_policy_count` → 5, `get_claim claim-2` → `decided_confirmed` / `threshold_crossed` / `observed_value_scaled: 120`
- Evidence snapshot (real fetch): `fixtures/historical/paris_2024-06-01_2024-06-05.json`, re-verified against the live endpoint 2026-10-13 — station `48.89279,2.2920206` and daily values match the on-chain evaluation exactly

> Corrections: this entry previously cited `deploy-studio.txt`, `source-studio.txt`,
> `claude-parsed-claim-2-evidence.txt` and a deploy hash `0x18e9a346...0e28`. Those
> files did not exist and the hash was truncated; both are removed. The contract
> address and the claim-2 outcome are verified above.

NEXT
- Add `tests/integration/` and run gate 3.
- Demonstrate `finalize_decision` + `settle_claim` on a policy with a non-zero payout.

BLOCKED
- StudioNet eval smoke was slow to time out this session due to HTTP 503 from the
  OM historical endpoint during the attempted live eval window. The endpoint is
  reachable now — claim-4 and claim-5 both evaluated successfully through it.
