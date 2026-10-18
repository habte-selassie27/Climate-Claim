# Changelog

Each session appends one entry: **DONE / PROOF / NEXT / BLOCKED**. Failures and
gaps are stated plainly; nothing is claimed that was not run.

---

---

## Refactor: the app follows the two deployed contracts, and no stale record remains

### DONE

**Removed the stale data at the source, not in the UI.**

The 6 policies and 5 claims on screen came from
`src/data/onchain-snapshot.json`: 6 policies and 5 claims read from
`0xE16032420e3155C0822e9150a98c6B1163869F0c` on StudioNet, a contract that is not
deployed. It was wired as a **silent fallback** — whenever the RPC failed, those
records rendered as though they were current — and the demo defaulted to a
hardcoded `claim-2` from the same retired contract.

The file is deleted rather than repointed, because there is nothing honest to
repoint it to. The current deployment starts with zero claims, and an empty
state is correct where another deployment's records are not. The `snapshot` and
`mixed` data origins are gone with it; a failed read now yields no data.

**Two creation workflows, both driven by the deployed schemas.**

- **Create Policy** existed at `/policies/new` and was already correct against the
  schema. Kept, and its arity is now pinned by a test (18 parameters).
- **Create Claim** is new at `/claims/new`, reachable from a button on the claims
  page and from its empty state. It lists live policies and submits
  `start_claim(policy_id, period_start, period_end)`.

**The demo is dynamic.** It lists every claim read from `list_claims`, lets one
be selected, and handles loading, error, empty and populated states. Recorded
replays moved into a separate section that runs the deployed
`compute_evaluation`, so a replay outcome is derived on chain rather than stored,
and is labelled "Not transactions".

**Verified the whole path on chain rather than assuming it.** Registered two
sources, created `policy-1` (Paris, `gt` 1.00 mm), bridged it with
`register_policy_snapshot`, opened `claim-1`, and recorded the decision that
`compute_evaluation` **derived**: `confirmed` / `threshold_crossed`, observed 125
(1.25 mm), 2 evidence rows. Every write: ACCEPTED / AGREE / FINISHED_WITH_RETURN.

Two real bugs surfaced while doing it:
- Paris was seeded at `488500000` micro-degrees instead of `48850000`, and the
  contract correctly reverted `EXPECTED: invalid coordinates`. That is a
  latitude of 488 degrees against a `+-90_000_000` ceiling — the validation
  working.
- `genlayer write --args '{"id":"probe"}'` **cannot pass JSON**: the CLI strips
  the double quotes, so the contract received a malformed string and reverted
  `invalid policy JSON`. JSON arguments must go through genlayer-js.

**Directories audited.** `fixtures/` lost the `on_chain_claims` block (the
recorded responses are real and stay). `docs/` deployment record rewritten,
`schema.json` regenerated from the schemas read back after deployment,
`equivalence.md` now separates what is deployed from what is not. `scripts/` lost
11 obsolete StudioNet scripts and gained two that fail safely. `tests/` replaced
the obsolete-record test with one that guards against reintroduction.

**Stated rather than hidden:** `register_policy_snapshot` is owner-only, so a
brand-new policy cannot back a claim until the owner bridges it. `/claims/new`
says so instead of letting it read as a bug, and nothing simulates a claim the
chain refused.

### PROOF

| Gate | Result |
|---|---|
| `genvm-lint` contracts/Climate-Policy.py | OK — 8 methods |
| `genvm-lint` contracts/Climate-Claim.py | OK — 16 methods |
| `pytest tests/direct` | 33 passed |
| `pytest archive/tests` | 170 passed |
| `tsc -b --noEmit` | clean |
| `vitest run` | 356 passed, 27 files |
| `npm run build` | ok |
| `scripts/verify-deployment.sh` | all checks passed |

Chain contents, read back: **2 sources, 1 policy, 1 claim**. Both addresses hold
bytecode on Bradbury (chain `0x107d` = 4221), and every method the UI calls
answers.

### NEXT

Nothing blocking. The frontend reads live; `compute_evaluation` is not yet wired
into the claim detail screen as a live re-derivation of the stored decision.

### BLOCKED

Nothing. StudioNet remains rate-limited (500/hour) but is no longer depended on.

---

## Decision engine moved into Climate-Policy; the evaluator contract is deleted

### DONE

**Deleted `reference/Climate-Evaluator.py` and renamed `Climate-Claim-Small.py` to
`Climate-Claim.py`.** The evaluator was never going to deploy: both testnets cap
a deploy at roughly 19 KB of source and that file was 26 KB. Two rejected deploy
attempts are on the record, so this was measured rather than assumed.

**The engine it contained now lives in `Climate-Policy.py` as
`compute_evaluation`** -- a pure function of (frozen policy, evidence rows) that
returns the decision, reason code, per-check statuses and observed value.

This closes the single largest gap in the deployed pair. `ClimateClaim`'s
`record_evaluation` is owner-only and stored whatever decision the owner supplied
while verifying nothing, so "confirmed" was an assertion. It is now a derivation:
a row's `crossed` flag is recomputed from the raw scaled value and the frozen
threshold, and a decision that contradicts those numbers cannot be produced.

It lives in Climate-Policy for two reasons: ClimateClaim sits exactly at the
ceiling with no room for anything, and an engine with no storage reads and no
clock can be called from inside a non-deterministic round without version skew.

**Two things were cut, both deliberately.**

1. *The equivalence layer.* It existed to reconcile leader/validator disagreement,
   which only arises when the engine fetches the web or calls a model. This
   engine is pure, so both compute identical results and `run_nondet` would
   reconcile nothing. Removing it freed ~3 KB, which is the difference between
   deploying and not.
2. *The `location_match` check.* Evidence rows carry no coordinates, so the check
   could only ever return `unclear`. Dropping a check that cannot resolve is
   smaller and more honest than reporting it forever as unknown.

### PROOF

Deployed to Bradbury by `0x04e0353B7218b66D6803725ce7342E6e1225DB1b`, both
ACCEPTED / AGREE / FINISHED_WITH_RETURN:

- ClimatePolicy `0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807` (16,829 B, 8 methods)
  deploy tx `0x8f704bc3bab2578a5c66981ba922dfb349a65f6817acac475af68d046889f658`
- ClimateClaim `0x07C1c5740eD73576deF939bb938556761738dA03` (18,600 B, 16 methods)
  deploy tx `0xa7deeaceb6ef12ca8b2a226c45b5502b062b344942859930300d52d5c2c7c631`

`compute_evaluation` exercised on chain through genlayer-js, threshold 1.00 mm,
two sources:

| Case | Decision | Reason | Observed |
|---|---|---|---|
| both sources above | confirmed | threshold_crossed | 140 |
| both sources below | not_confirmed | threshold_not_crossed | 85 |
| exactly at threshold, `gt` | not_confirmed | threshold_not_crossed | 100 |
| exactly at threshold, `gte` | confirmed | threshold_crossed | 100 |
| sources disagree | inconclusive | source_conflict | 105 |
| majority, 1 of 2 | inconclusive | source_conflict | 105 |
| `any` rule, one crosses | confirmed | threshold_crossed | 105 |
| partial period | inconclusive | missing_observations | 140 |
| one source unreachable | inconclusive | missing_observations | 150 |
| `min_sources` satisfied by 1 | confirmed | threshold_crossed | 150 |
| `lt` policy, values below | confirmed | threshold_crossed | 45 |
| `min_sources` unmet | reverts `EXPECTED` | | |

Gates: `genvm-lint` 3/3 clean (7 + 16 + 8 methods), `pytest tests/direct` 33
passed.

### NEXT

Wire the frontend to the two new addresses and surface `compute_evaluation` in
the claim detail view, so a decision is shown as derived from evidence rather
than entered by the owner.

### BLOCKED

Web retrieval from on-chain code. Fetching a live source needs a model call or
web access inside a non-deterministic round, and the space for both is gone.
Evidence rows are supplied by the caller and their provenance is not provable on
chain. This is stated plainly rather than papered over.

## The deploy ceiling, measured in bytes — and why the evaluator has no home on chain yet

### DONE

**Established what a GenLayer contract may actually weigh, by experiment rather
than by reading.** Earlier sessions knew only a line-count bracket (793 lines
rejected, 427 accepted). That bracket is not the real constraint and it was
misleading: comment lines cost exactly as much as code lines.

A probe was deployed whose logic was a single getter and whose body was 90%
comments. It was **rejected**. That single result rules out line count, AST size
and logic complexity, and pins the limit to source text:

| Source text | Result |
|---|---|
| 18,600 B — `Climate-Claim-Small.py` | deployed |
| 20,907 B — trivial getter, 90% comments | rejected, `gas limit too high` |
| 26,103 B — `reference/Climate-Evaluator.py` | rejected on Bradbury **and** Asimov |
| 30,314 B, 48,874 B, 63,506 B | rejected |

So a contract on these testnets has roughly a **19 KB source budget, comments
included** — about 430 lines at the density of the deployed files.

**Wrote the consensus evaluator, and then proved it cannot ship.** A third
contract performing the actual evaluation (fetch → normalise → aggregate →
integer threshold comparison → validator agreement) was built and is lint-clean
at 4 methods. It was compressed from 48,874 B to 26,103 B by removing the model
call, the NASA parser, the temperature metric, the `consecutive_days`
aggregation, the owner and its ownership checks, the owner-registered policy
snapshot, stored criteria versions, per-check detail strings and most docstrings.
It is still 7.5 KB over budget, and the only remaining 7.5 KB *is* the
equivalence logic (`_fetch`, `_once`, `_valid`, `_equivalent`). Deleting it would
delete the reason the contract exists, so the compression was stopped on purpose.

**Asimov checked as a possible escape and closed off.** Asimov is a genuinely
separate chain — our deployed ClimatePolicy is a `CONTRACT` on Bradbury and an
empty `ACCOUNT` on Asimov — and the deployer holds ~9.97 GEN there, so it was a
real candidate. It rejected the evaluator with the identical error.

**Moved the evaluator to `reference/`.** `contracts/` is documented as holding
only what is deployed, and that has to stay true. The file, its equivalence
design and the size analysis now live in `reference/README.md`.

### PROOF

- `genvm-lint`: 3/3 clean — Climate-Policy (7 methods), Climate-Claim-Small
  (16), reference/Climate-Evaluator (4).
- `pytest tests/direct`: **33 passed**.
- Rejections above are real RPC responses from `deploy`, not inferences. Every
  accepted/rejected pair in the table was submitted.
- `contracts/README.md` now carries the byte-precise table in place of the
  line-count one.

### NEXT

Deploy `reference/Climate-Evaluator.py` to **StudioNet** — it accepted the
1,406-line / 63 KB pre-split contract, so it has the headroom (~30 KB needed).
It was unreachable throughout this work purely because of its 500-requests-per-
hour limit, which is a rate limit and not a size limit. No code change is
required, only a window where the limit is not exhausted.

### BLOCKED

On-chain consensus evaluation, on Bradbury and Asimov, by source size. Not
fixable by refactoring — the engine is irreducibly larger than the ceiling.

---

## Evidence chart: animated 3D view (2D and table one click away)

### DONE

**The evidence panel now opens on a 3D column chart.** Grouped columns per
day — box for the first source, cylinder for the second, so the series differ
by shape as well as colour — grown in with a staggered ease when the panel
scrolls into view. A slow turntable keeps the scene moving and pauses while
you drag or hover; dragging spins and tilts (elevation clamped); hovering a
day raises a selection frame and swaps the chip's hint for that day's
readings; the threshold is a translucent plane that sweeps in and floats at
its true height with a labelled edge; shelf outlines sit at every axis tick
with values on the back-left corner; the ground is a grid with real soft
shadows. Recording honesty is unchanged: a recorded 0 draws a hairline
column, a missing reading draws NO column and an amber ground cross (never a
fake zero), and the amber halo may only sit on a day `compareSources()`
classifies as a split. Nothing new computes numbers — heights come from
`niceScale` plus the new pure, tested `domain/chart3d.ts`; crossings from
`meetsThreshold`.

**The 2D view and the table view remain**, one toggle away, because
perspective genuinely distorts exact height comparison and the 2D view keeps
the per-point keyboard walk through the readings. The `useChartReveal`
docstring's old "why 2D, not 3D" note now describes the arrangement, and the
hook exposes `inView`/`run` so the 3D scene re-runs its growth on replay.

**Bug fixed on the way:** the reveal hook's `ref` was never attached to the
chart shell, so the reveal sequence never armed in a browser. It is now
attached — and the hook hands out a callback ref, because the object-ref
shape it previously returned is not assignable to a JSX `ref` attribute, so
attaching it could not have compiled before.

### PROOF

- `npm test` → 228 passed (17 files) on this commit's tree; includes 12 new
  `chart3d` tests and the reworked `EvidenceChart` tests (the 2D frame is
  asserted via `initialMode`, plus 3D-default container/toggle/
  accessible-carrier checks)
- `npm run build` → clean on this commit's tree
- Vercel bundle checked after push (chart-3d markup and CSS present)

### NEXT

- On-chain queue unchanged: waits on the StudioNet quota window.

### BLOCKED

- Nothing on this change.

---

## Hero ambience: rain streaks back, opt-in rain + thunder sound

### DONE

**The rain-streak backdrop (PrecipitationField) is back, layered behind the
evidence field** — streaks at z 0, the three.js scene at z 1, copy above. Its
material swapped AdditiveBlending for normal alpha: additive is invisible
against a light page (white plus anything is white), which is exactly what the
light theme showed. The rain readout note is hidden inside the hero because
the field's HUD already owns that corner.

**Opt-in rain and thunder, synthesised with the Web Audio API** — no audio
files to ship or license. Rain is looped white noise through a high-pass /
low-pass pair; thunder is a darkening noise burst over a sub-bass sine.
Nothing is created until the toggle is pressed (browsers block autoplay, and
doing it anyway would be hostile); the first clap arrives within 2.5–5 s so
the button is audibly connected to an effect; later claps are sparse (9–22 s,
cadence pinned in `frontend/src/domain/ambience.ts` and tested); turning it off
closes the AudioContext rather than muting it; and the context is suspended
while the tab is hidden. The toggle is a real button with `aria-pressed`,
labelled in all four locales (new `hero.sound.on/off` keys behind the existing
placeholder-parity test).

### PROOF

- `npm test` → 173 passed (13 files), including 3 new `ambience` tests
- `npm run build` → clean (verified from a clean worktree of this commit)
- Push to `main`; Vercel bundle checked after deploy (toggle markup + CSS
  present in the served assets)

### NEXT

- On-chain queue unchanged: waits on the StudioNet quota window.

### BLOCKED

- Nothing on this change.

---

## Home hero: the supplied three.js evidence field

### DONE

**The Home hero now renders the supplied "Three.js UI" mock as a live scene.**
One bar per source per day (first source a box, second a cone), the policy
threshold as a translucent red plane, day labels, and an amber halo on the day
the sources disagree — over the mock's 150-point particle net. Drag to rotate
(the mock's `dx * 0.008` sensitivity); auto-rotation and the halo pulse stop
under `prefers-reduced-motion` (a single still frame is rendered instead, and
dragging still redraws), and the render loop stops when the hero is off-screen
or the tab is hidden. Three.js stays in its own lazy chunk (747 kB raw /
192 kB gzip) and never reaches first paint; the whole component is
`aria-hidden` because every fact in it is repeated in the accessible chart and
tables below.

**The scene is data-driven, not the mock's hardcoded arrays.**
`frontend/src/domain/fieldLayout.ts` (14 tests) derives bar heights and day
positions from the recorded conflicting-sources readings; the halo day comes
from `compareSources()` in `sourceCompare.ts` — the same split-day logic the
comparison table uses — so the halo cannot sit on a day the data does not call
a disagreement. A day a source did not return draws **no bar** (a missing
reading is not a zero); a recorded 0.0 draws the minimum stub. The bar/plane
relation is pinned by test: MERRA-2's 2.03 clears the 1.50 plane, ERA5's 1.10
does not.

**Legend and tip are localized** ("threshold 1.50 mm"; "Jun 4: sources
disagree · drag to rotate") — three new keys in all four locales, covered by
the existing placeholder-parity test.

**The rain-streak backdrop was replaced in the hero** — the mock has no rain.
`PrecipitationField.tsx` is untouched and still in the tree if we want it
elsewhere.

### PROOF

- `npm test` → 170 passed (12 files), including the 14 new `fieldLayout` tests
- `npm run build` → clean (tsc + vite); three.js emitted as its own chunk
- Pushed to `main`; the Vercel production build serves the new bundle (checked
  after push — see the session report for the exact asset names)

### NEXT

- The on-chain queue (StudioNet redeploy, live-mode claim, dispute walk) waits
  for the daily RPC quota window.

### BLOCKED

- Nothing on this change.

---

## Demo usability, evidence comparison, print receipt, shareable language

### DONE

**Claims table (Tier 2 item 4).** Text search (claim id / policy id / claimant), filters
by decision (including a "not decided" facet that covers failed evaluations) and by
state, and pagination (8 rows/page). Filtering and paging are pure functions in
`frontend/src/domain/claimsQuery.ts`, unit tested; a filter change resets to page 1, a
"showing X of Y" line keeps the total visible, and an all-filtered-out table says so
instead of rendering empty.

**Error boundary (item 5).** `frontend/src/components/ErrorBoundary.tsx` wraps the
routed content inside the shell: a render crash or failed lazy chunk shows a localized
fallback with *Try again* (re-mount) and a link home, plus the raw message behind the
same *Details* disclosure used elsewhere; the chrome and every other route stay usable.

**Honest form states (item 6).** PolicyNew's source picker shows a skeleton while the
registry reads, an explicit "unreadable or empty" alert with a Retry button when there
is genuinely nothing to choose, and a muted "recorded snapshot; live read failed (…)"
note when the fallback is on screen. The sentence preview now lists what is still
missing (`Still missing: location name, observation dates, …`) instead of leaving its
stand-ins unlabelled.

**Print receipt (item 7).** A `@media print` block in `global.css` forces the light
palette, hides chrome/buttons/the actions panel (`data-print="hide"`), keeps panels
whole across page breaks and prints a receipt-header line (timestamp, contract,
network) that is screen-hidden. The claim page gains a *Print receipt* button.

**Per-day comparison (item 8).** With two or more sources, the demo page shows a
per-day table beside the chart: each source's reading, the spread, an explicit verdict
per day, and the disagreement days highlighted and named in a summary line. Computed by
`domain/sourceCompare.ts` (17 tests) — no interpolation, missing days stay missing.

**Deterministic contrast (item 9).** For the conflicting-sources scenario, a
side-by-side panel shows the pass/fail each single hard-wired source would force (one
pays out, one denies, computed from the same recorded readings by the policy's own
comparison rule) against the deployed contract's honest third answer, *inconclusive —
source conflict*. Clearly badged a thought experiment; never presented as a chain
result.

**Chart accessibility (item 11).** The svg's aria-label is now short (source and day
count) with the full narrative left in the visible summary; every data point is
focusable with its own label and arrow-key / Home / End navigation (roving tabindex).

**Shareable language (item 12).** A supported `?lang=` parameter decides the initial
locale ahead of the stored preference, and every locale change writes `?lang=` back via
`history.replaceState`, preserving other parameters; the demo scenario switcher now
preserves them too, so `/demo?scenario=conflict&lang=fr` opens exactly that. Rules
pinned in `frontend/src/i18n/url.test.ts`.

Also: 55 new i18n keys in all four locales (completeness and placeholder parity are
enforced by the existing i18n tests), and `scripts/live-claim.sh` — the runbook for
item 10 (live data_mode): redeploy current source → seed registry → create a policy
whose window ends today against `om_forecast_precip` → evaluate → read back.

### PROOF

- `cd frontend && npm test` — **148/148 passed** (10 files; was 105/7).
- `npm run build` — clean (tsc + vite, 4.48s).
- Bundle names changed (`index-BEX_ndpy.js`, `Claims-DuK-KKMV.js`, `Demo-lTZV3FvA.js`,
  `ClaimDetail-DHcMmYfo.js`, `PolicyNew-C7UziXcS.js`).

### NEXT

- After the RPC quota resets: `scripts/redeploy-studionet.sh`, update the address
  (`frontend/src/config/contracts.ts`, `.env`, `.env.example`, env-consistency test),
  then `scripts/live-claim.sh <new-address>` for the live-mode claim, followed by the
  dispute walk (`scripts/dispute-claim.sh`) and the finalize → settle walk.

### BLOCKED

- Item 10's on-chain run and the dispute/settlement walks: StudioNet RPC daily quota
  (5,000 requests/day) until ≈19:15 UTC. `scripts/live-claim.sh` and
  `scripts/dispute-claim.sh` are written but not yet executed.

---

## Claim audit receipt export (JSON) + status-panel label fixes

### DONE

The claim page now exports its **audit receipt**: one JSON file carrying
everything the page showed — policy terms, per-source evidence, per-check
results, decision + reason code, dispute history, settlement state — plus a
provenance block (record version, contract address, network, chain id, data
mode, record origin live/mixed/recorded-snapshot with capture time and any
live-read error, and the session's transaction hash + explorer link). The
record is assembled only from the bundle the page renders, so the export can
never contain data the screen did not show.

- `frontend/src/domain/auditExport.ts` — `buildAuditRecord()` (pure,
  versioned: `climateclaim-audit-record-1`), `auditRecordFilename()` (ids
  sanitised), `downloadAuditRecord()` (browser download; returns false instead
  of throwing when browser APIs are absent);
- `ClaimDetail.tsx` — "Export receipt (JSON)" button in the audit panel head;
- new i18n keys `audit.export` / `audit.exportHint` in all four locales.

Two claim-page honesty fixes found while wiring this up:

- the shared transaction status panel was hardcoded to label every write
  "Request evaluation" and retried `request_evaluation` no matter which action
  had failed — it now remembers the action sent (`lastWrite`) and labels and
  retries *that* write, so a dispute or payout is never reported as an
  evaluation;
- a `t(...)` call sat inside a JSX comment, so the payout-help sentence was
  never rendered and two locale keys (`claimDetail.settle.emittedHelp`,
  `…emittedHelp2`) existed only for that dead reference — comment rewritten,
  both keys removed from en/es/fr/de.

Also: `scripts/dispute-claim.sh` added for the live dispute round
(`open_dispute` → readback → `resolve_dispute` → readback, receipts saved to
`artifacts/studionet-v2/`), and the README honesty-rules list gained the export
bullet.

### PROOF

- `npm run build` in `frontend/` — clean (tsc + vite, built in 3.22s).
- `npm test` in `frontend/` — **7 files, 105 tests passed** (12 new in
  `auditExport.test.ts`; the suite was 93 before).
- `grep -rn "emittedHelp" frontend/src` — no references remain;
  the i18n parity tests still pass across en/es/fr/de.

### NEXT

- After the RPC quota reset (~19:15 UTC): create the London Set 3 policy
  (draft restored in the browser), then run `scripts/dispute-claim.sh` on a
  decided claim and `scripts/seed-v2-phase-d.sh` for the finalize → settle
  walk. Note v2 settles in one phase; `confirm_settlement` exists only in the
  current source, so the two-phase demo needs the redeploy.
- `scripts/dispute-claim.sh` has not been executed yet — it is written to the
  verified CLI pattern of the seed scripts, and its first run is the real test.
- Push this entry; verify the live bundle carries `climateclaim-audit-record-1`.

### BLOCKED

- StudioNet public RPC: `-32029 Rate limit exceeded: 5000 requests per day`,
  resets ~19:15 UTC on 2026-10-16. All on-chain writes (London policy, live
  dispute, finalize, settle) wait for the reset or a different IP.

---

## Point explorer links at the live official StudioNet explorer

### DONE

The app treated the StudioNet explorer as paused (the old
`genlayer-explorer.vercel.app` alias from the chain definition was captured
returning `DEPLOYMENT_PAUSED` on 2026-10-13) and so disabled every transaction
link. The official explorer is live at `https://explorer-studio.genlayer.com`,
and its routes were probed directly: `/tx/<hash>` and `/address/<addr>` return
200, while the `/transaction/<hash>` path the app was building returns 404 on
StudioNet, Asimov and Bradbury alike — so even the links marked "available"
were dead routes.

Changes:
- `frontend/src/config/network.ts`: StudioNet points at the official explorer
  and is marked available; every network carries a verified `txPath` (`/tx/`);
  explorer base URLs no longer carry a trailing slash;
- `frontend/src/components/CopyField.tsx`: links are built as
  `explorerUrl + txPath + hash`; the hardcoded `/transaction/` route is gone;
- `AuditPanel.tsx` passes the configured `txPath` through;
- `README.md`, `docs/ui-sketch.md`, `artifacts/DEPLOYMENT.md`: the
  paused-explorer statements are replaced with the verified status.

### PROOF

- Direct probes, 2026-10-16 (curl status codes):
  - `https://explorer-studio.genlayer.com/` → **200**, title "GenLayer Studio
    Explorer";
  - `…/tx/0x85748a90…cc8809f` (the v2 deploy tx) → **200**;
  - `…/address/0x6E4BD06b…82ea8` (the live contract) → **200**;
  - `…/transaction/<hash>` → **404** on studio, asimov and bradbury.
- `npm run build` in `frontend/` — clean (tsc + vite, built in 3.68s).
- `npm test` in `frontend/` — 6 files, **93 tests passed**.

### NEXT

- Deployed by the push that carries this entry; verify the live bundle carries
  the official explorer base and the `/tx/` route.

### BLOCKED

None.

---

## Clear the stale wallet-gate banner on Create policy

### DONE

The "Connect a wallet first" banner (and the wrong-network and owner-only
variants) was set when Create policy was pressed and never cleared, so
connecting the wallet afterwards left a dead message on screen and the form
looked broken even though the gate would now pass. `PolicyNew.tsx` now clears
the banner whenever the wallet connection, network or owner state changes.

Clearing is always safe: the banner disables nothing, and `submit()` re-checks
every gate on each click, so the next click re-explains any blocker that is
still present.

### PROOF

- `npm run build` (tsc + vite) in `frontend/` — clean, built in 3.45s.
- `npm test` in `frontend/` — 6 files, **93 tests passed**.

### NEXT

- Deployed by the push that carries this entry; verify on the live site.

### BLOCKED

None.

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

After pushing `2450fe3` and the Vercel redeploy (checked ~30s later):
- `GET /claims` -> 200, `GET /claims/claim-2` -> 200, `GET /how-it-works` -> 200,
  `GET /policies/new` -> 200
- `/claims` now serves the SPA bundle (`<div id="root">` + `assets/index-*.js`),
  so deep links and hard reloads route client-side as intended.

### NEXT

- None for this fix. Remaining fragility: anyone changing the Vercel Root
  Directory must keep a matching config inside that root — both cases
  (repository root and `frontend/`) are now committed and documented.

### BLOCKED

None.

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

## Redeploy attempt — BLOCKED on StudioNet daily write quota

### DONE

Attempted the redeploy that unblocks `confirm_settlement` / `fail_settlement` and
the `get_in_flight` / `get_refunds` / `get_payouts` / `get_source_count` views.
The deploy **did not happen** — the network refused it. Everything up to the
network call is verified and ready.

**Pre-flight verified**

- Gates: `genvm-lint` ✓ Lint passed (3 checks) + ✓ Validation passed,
  `Methods: 32 (19 view, 13 write)`; `pytest tests/direct/ -q` → **200 passed**
- Network already on `studionet` (built-in; no manual RPC override)
- Account `rabby` is active, unlocked, holds 701 GEN
- The key in the gitignored `.env` was checked to derive to
  `0x5B3661C576c7001e6d6279C67F3779705d334c89` — the same address as the active
  account and as `DEPLOYER_ADDRESS` in `contracts.ts`. The key was never printed.

**Also done:** added `scripts/redeploy-studionet.sh`, which runs the gates, sets
the network, refuses to proceed if the active account is not the owner, deploys,
captures `docs/schema.genlayer-cli.txt`, proves the six missing methods now exist,
and prints the exact manual follow-ups (address in `contracts.ts`, address in
`.env`/`.env.example`, then the drift test). Executed end to end and confirmed it
fails cleanly with an actionable message rather than a stack trace.

### PROOF

```
Details: Rate limit exceeded: 5000 requests per day
data: { bucket: 'standard', window: 'day', limit: 5000, current: 5000,
        retry_after_seconds: 16852 }
```

- Raw JSON-RPC reads still work: `eth_chainId` → `0xf22f` (61999), read bucket
  300/min with 296 remaining. Only the write bucket is exhausted.
- The failure occurred at fee derivation, before a transaction was constructed,
  so no contract was created. That could not be confirmed on-chain because
  `genlayer call` also draws on the exhausted bucket.

### BLOCKED

StudioNet's daily **write** quota is spent (5000/5000). It resets at roughly
**2026-10-16 22:15** local, and the limit is per day, not per minute — waiting a
few minutes does not help.

Next command, once it resets:

```bash
scripts/redeploy-studionet.sh
```

Asimov and Bradbury were checked as alternatives and both hold **0 GEN**. The
faucet (`https://testnet-faucet.genlayer.foundation/`) is browser-based, so
funding them is a manual step for the user.

---

## Chart axis fix, table redesign, and a data-driven Three.js hero

### DONE

Three things the earlier review flagged, plus the requested hero.

**1. Real chart bug fixed.** The evidence chart placed gridlines at fixed
fractions of the axis top (`[0, 0.25, 0.5, 0.75, 1]`) and labelled them with
`toFixed(1)`. On a 2.5 mm axis that produced **0.0 / 0.6 / 1.3 / 1.9 / 2.5** —
evenly spaced *lines* carrying unevenly spaced *numbers*, so a reader infers
distances that do not exist. `domain/chartScale.ts` now picks a round STEP first
(1/2/5/10 × a power of ten, Hastings) and derives the top from it, giving
0.0 / 0.5 / 1.0 / 1.5 / 2.0 / 2.5. Precision comes from the step's own decimal
representation, so a 2.5 step still labels as "2.5" rather than rounding to "3".
Ticks are accumulated by index, not by repeated addition, because 0.1 + 0.2 drifts.

**2. Tables redesigned.** Sticky header with a hairline shadow so rows read as
passing beneath it; zebra banding (tints only, so it adds no meaning and breaks
neither the colour-is-never-the-only-signal rule nor printing); roomier padding;
tabular numerals on numeric columns; hover affordance; a card border and radius
instead of a bare grid. All token-driven, so dark theme and print inherit it.

**3. Three.js hero.** `components/PrecipitationField.tsx` — an atmospheric
precipitation field whose particle density and fall speed are driven by the real
recorded readings of the conflicting-sources scenario, so the visible divergence
between the two sources is the divergence in the data (1.10 mm vs 2.03 mm).

It is explicitly decoration, and the component says so: no axes, no values, no
claim. Reading exact numbers is the SVG chart's job and 3D is worse at it, so
every quantitative surface on the page remains 2D.

### PROOF

- Frontend: `npx vitest run` → **156 passed** (11 files), including 8 new
  `chartScale` tests covering the original regression, even spacing, sub-1
  values, degenerate input and float drift
- `npx tsc -b --noEmit` clean; `npx vite build` → built in 12.62s
- Contract untouched: lint ✓ (3 checks) + ✓ validation; `pytest` → **200 passed**
- **Three.js is not in the first-paint bundle**: it builds to its own 730 kB
  chunk, referenced only via `import("./three.module-…")` from the lazy Landing
  chunk, and is absent from `index.html` preloads. Main chunk 152 kB → 169 kB.
- Deploy key still absent from `dist/`

### ACCESSIBILITY AND PERFORMANCE

- `prefers-reduced-motion: reduce` renders a still field and never starts a
  render loop
- Rendering stops when scrolled out of view (`IntersectionObserver`) and when the
  tab is hidden (`visibilitychange`)
- Device pixel ratio capped at 1.75; scene disposed and canvas removed on unmount
- WebGL failure, a blocked chunk or an old browser degrades silently to the CSS
  gradient fallback — the page never breaks
- The canvas is `aria-hidden`; the peak readout is real text, not painted

### NOTE FOR REVIEW

- `color-mix()` is used in the table/hero styling. Supported in Chrome 111+,
  Safari 16.2+, Firefox 113+. Fine for a modern reviewer; worth knowing if you
  must support older browsers.

### BLOCKED

Nothing for this change.

---

## Redeploy attempt — still BLOCKED (StudioNet quota, then a Bradbury gas bug)

### DONE

Tried the redeploy again on two networks. **Neither succeeded.** Both blockers are
external and are recorded so the next attempt is not re-derived from scratch.

### Path A — StudioNet: daily write quota

Unchanged: 5000/5000 requests per day, resets at **2026-10-16 22:15:33** local
(~4h30m after the last attempt). Reads are fine (300/min). A deploy needs a write.

### Path B — Bradbury: the node rejects the SDK's gas limit

New account supplied, verified before use:

- The key was checked to derive to the stated address
  `0x04e0353B7218b66D6803725ce7342E6e1225DB1b` — never printed, stored only in the
  gitignored `.env`. **That key was pasted into a chat and should be rotated
  after use.**
- Imported as account `bradbury`, unlocked, holding **9.98 GEN**.
- Bradbury RPC reachable, chain id `0x107d` = 4221.

Deploy still fails with:

```
GenLayer RPC error (eth_sendRawTransaction): gas limit too high
```

Diagnosis, read from the SDK source rather than guessed:

- `genlayer deploy` reaches `genlayer-js` `_sendTransaction`, which sets
  `gas: estimatedGas` from `client.estimateTransactionGas`.
- `deployContract` accepts **no `gas` parameter** — only `account, code, args,
  kwargs, leaderOnly, consensusMaxRotations`. A gas value passed to it is
  silently ignored, which is why a retry at 90M produced an identical error.
- `genlayer estimate-fees` is broken in the latest CLI (0.39.2):
  `client.estimateTransactionFees is not a function`. So there is no supported way
  to obtain or override a fee/gas preset.
- No `--gas` flag exists on `deploy`, and none is documented.
- 90M was already below Bradbury's advertised block gas limit (100M), so the node
  enforces a per-transaction cap the SDK is unaware of.

Fixing this would mean patching `node_modules`, which was not done: a local hack
that diverges from the published SDK and breaks for anyone else. The temporary
`scripts/deploy-with-gas.mjs` written to prove the point was deleted rather than
shipped, since it cannot deliver the gas override its name promises.

### BLOCKED

- **StudioNet** — wait for the quota, then run `scripts/redeploy-studionet.sh`
- **Bradbury** — needs an upstream SDK fix (a gas override in `deployContract`,
  or `estimate-fees` repaired) before any deploy can work

### ALSO WORTH KNOWING

Even if Bradbury worked it is not a drop-in substitute. The deployed contract
holds **7 seeded policies and 5 claims**; a fresh Bradbury deploy starts empty and
needs re-seeding via `scripts/seed-v2*.sh`. It would also move the app off
StudioNet (chain 61999 → 4221), repoint `network.ts`, and require Bradbury funds
in the browser wallet. The one genuine upside: Bradbury's explorer works, whereas
StudioNet's is paused, so transaction links would resolve.

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

## Bradbury deploys small contracts — the gas ceiling is size-dependent

BREAKTHROUGH. A 2-method probe contract deployed and ran a full lifecycle on
Bradbury, which no ClimateClaim attempt had achieved. Verified end to end:

- Deploy: `FINISHED_WITH_RETURN`, consensus `AGREE`, status `ACCEPTED`
- View read returned the constructor value (`hello`)
- Write `put` returned `AGREE` / `ACCEPTED` / `FINISHED_WITH_RETURN`
- Read back returned `from_genlayer`

Contract: `0xA1b9D5BF918237dD0C3c04a97059c08410d8c348`
Deploy tx: `0xec99492527cd07c2b23a565f4279a287a784c8aec34c4959a089b915dbb1287a`
Write tx:  `0x...` (put -> from_genlayer)

CONSEQUENCE: issue #419's "gas limit too high" is not a blanket Bradbury limit.
It is size-dependent, so SPLITTING ClimateClaim into smaller contracts is a
viable route to a public Bradbury deployment — which is what the single-file
design had ruled out.

Two lessons found the hard way:

- A class must inherit `gl.Contract`. A bare `class Probe:` deploys to
  consensus and then fails execution with `Exception: no contract defined`, and
  the CLI still reports "Contract deployed successfully" because consensus agreed.
  Always trace a `FINISHED_WITH_ERROR` rather than trusting the CLI's success line.
- `genlayer write <addr> <method> <value>` is rejected by the CLI ("too many
  arguments"). Arguments go after `--args`: `genlayer write <addr> <method> --args <value>`.

Cross-contract read (the gate for the split) is NOT yet working. A proxy stored
in contract state fails with:

    TypeError: class is not marked for usage within storage,
    please, annotate it with @allow_storage

That is a fixable pattern issue, not yet evidence that IC-to-IC calls are
unsupported. Unresolved.

## Both split contracts deployed to Bradbury

DONE. The user-authored two-contract split is live on GenLayer Bradbury (4221):

- ClimatePolicy  `0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631` (260 lines, 7 methods)
  deploy tx `0x4bd15661906406d0d5b63dc51cef8ebb4c122e0d7788e2d0f0d9111f9c250516`
- ClimateClaim   `0xa2D82Db4ddC567199113962BFd477f069510331D` (427 lines, 16 methods)
  deploy tx `0x6130f4f929c1612a52b49c2e8ce7c2f02260c41afa10fb965ddfa28c667309ff`

Both: accepted, FINISHED_WITH_RETURN, 5/5 AGREE. Reads verified on chain --
`list_sources`/`list_policies` return `[]`, `get_claim_count`/`get_escrow_balance`
return `0`. Schemas saved under `docs/schema/`. Full record in
`docs/deployment-bradbury-2026-10-18.md`.

PROOF. `eth_getCode` returns bytecode for both on rpc-bradbury.genlayer.com.
StudioNet returns "Contract ... not found" for both, which rules out the
deployment having silently landed on the wrong network. Explorer pages render.

Bradbury's gas ceiling was the whole blocker, and it is size-dependent: 793 lines
is rejected, 427 and 260 are accepted. StudioNet could not be used at all -- its
standard bucket reported 500/500 on both windows with retry_after bouncing
between 35s and 11000s, never actually draining.

NEXT. The frontend still points at the StudioNet monolith
`0x6E4BD06bD969E745546A7957d818eDaD47882ea8`. Reconciling the app with this new
two-contract interface is unstarted, and it is not a drop-in: the claim contract
exposes `record_evaluation` (owner-only) instead of computing a decision on chain,
so the app's evaluation flow has no on-chain counterpart here yet.

BLOCKED. Nothing blocking deployment. Open question: raw-RPC
`gen_getContractSchema` returns `absent_runner_comment` for both contracts while
the CLI's schema and call commands work against the same addresses.

## Frontend wired to the two Bradbury contracts

DONE. The app now talks to the deployed pair instead of the retired StudioNet
monolith:

- `config/contracts.ts` holds both addresses plus a `METHOD_META` router giving
  each method its contract and mutability. `addressFor(method)` is the single
  place a read or write gets its target, so a method cannot be sent to the
  contract that does not have it.
- `network.ts` defaults to Bradbury and the RPC/chain `.env` overrides moved off
  the StudioNet entry onto the active one. StudioNet's values are now literals, so
  a `.env` pointing at the live deployment can no longer silently rewrite the
  legacy chain's url.
- `claimService.ts` maps the new nested `get_claim` shape (evidence, disputes,
  payouts) onto the existing domain types. `get_source`, `get_policy_count`,
  `find_claim`, `get_evidence`, `get_disputes` and `get_settlement` are DERIVED
  from list reads; they are not real methods on either contract.
- `evaluationService.ts` routes writes by method, supports a payable `value` for
  `fund`, and drops `request_evaluation`.
- `ClaimDetail` no longer offers a "Request evaluation" button. It explains that
  this deployment records decisions rather than computing them. The check panel
  states that no per-check results exist instead of implying one is pending.
- `App.tsx` footer shows both addresses.

PROOF. `node` run of the app's own call path against the live chain, via
genlayer-js and the same router:

    list_sources @ policy  -> []
    list_policies @ policy -> []
    get_claim_count @ claim -> 0
    list_claims @ claim -> []
    get_escrow_balance @ claim -> 0
    get_refunds @ claim -> {"count":0,"total":0}

and routing proved load-bearing: `list_policies` sent to the CLAIM contract is
rejected (`call to private method __handle_undefined_method__`), which is why a
single configured address would not have worked.

GATES. genvm-lint 2/2 (7 and 16 methods); pytest tests/direct 203 passed;
env-consistency 33 passed; frontend tsc clean, 327 tests passed (up from 310, +17
new routing/network tests), build succeeds.

RESTORED, DELIBERATELY. `contracts/climateclaim.py` was deleted with the split,
which orphaned all 203 direct tests -- every one failed with
`FileNotFoundError`. It is restored and now documented as the pre-split source
that the tests cover, NOT as a deployment. See `contracts/README.md`.

NEXT. The gap that matters: the deployed pair has no direct test suite, and the
evaluation engine (weather fetch, model call, equivalence rule) is not deployed
anywhere. Closing that is the largest remaining piece of work.

BLOCKED. Nothing. Open question unchanged: raw-RPC `gen_getContractSchema`
returns `absent_runner_comment` for both contracts while the CLI's schema and call
commands work against the same addresses.

## Move the pre-split contract and its tests to archive/

DONE. `contracts/` now contains only the two DEPLOYED contracts, so "what is on
chain" has exactly one answer:

    contracts/Climate-Policy.py        260 lines,  7 methods
    contracts/Climate-Claim-Small.py   427 lines, 16 methods

`contracts/climateclaim.py` (1406 lines) and the 170 tests that load it moved to
`archive/`, which is outside `tests/` and therefore outside the default gate.

WHY ARCHIVED RATHER THAN DELETED. The file is not deployed, but it is the only
implementation of the evaluation engine -- Open-Meteo/NASA POWER retrieval, unit
normalisation, aggregation, integer threshold arithmetic, the model call and the
equivalence rule. Deleting it would leave the project unable to state how its
central claim is computed, and would orphan 170 tests with FileNotFoundError.
`archive/README.md` says all of this, including that the archived tests cover
nothing that is deployed.

GATES. Both suites run and both pass:

    python3.12 -m pytest tests/direct -q     33 passed  (config drift checks)
    python3.12 -m pytest archive/tests -q   170 passed  (archived contract)

Total is still 203, unchanged. genvm-lint 2/2; frontend tsc clean, 327 tests, build ok.

REFERENCES REPOINTED. Moving the file broke paths in tracked tooling and docs, so
each was updated to where the code now is:
`scripts/redeploy-studionet.sh`, `scripts/wait-and-redeploy-studionet.sh`,
`scripts/dispute-claim.sh`, `docs/state-diagram.md`, `docs/schema.json` and four
comments in `frontend/src/domain/types.ts` (each now points at whichever contract
actually has the symbol). `scripts/build-history.sh` is flagged as a historical
record whose paths are deliberately pre-archive -- it rebuilds history from an
orphan root commit and must not be re-run to "fix" them.

BUG FOUND WHILE REPOINTING. `ClaimDetail.tsx` capped dispute grounds at 300
characters, mirroring the archived contract. The deployed
`Climate-Claim-Small.py:232` allows **500**. The UI was rejecting grounds the
chain would have accepted. Fixed. The mismatch was invisible for a reason worth
recording: a client cap stricter than the contract's never produces a revert, it
just silently truncates what a user may say.

NEXT. Unchanged and still the largest item: the deployed pair has no direct test
suite, and nothing deployed evaluates anything.

BLOCKED. Nothing.
