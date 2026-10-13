# Changelog

Each session appends one entry: **DONE / PROOF / NEXT / BLOCKED**. Failures and
gaps are stated plainly; nothing is claimed that was not run.

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