# Builder portal submission — ClimateClaim (paste-ready, current)

Supersedes the earlier draft, which pointed at the retired `0x07C1…38dA03`
claim contract, a 1.20 mm observation, and five engine checks. Every value below
was read back from the chain or from a command run this session.

## Identity

- **Project:** ClimateClaim — evidence-based parametric weather claims
- **Repository:** <https://github.com/habte-selassie27/Climate-Claim> (branch `main`, commit `1da726a`)
- **Live app:** <https://climate-claim-fawn.vercel.app/>
- **Network:** GenLayer Bradbury, chain id 4221
- **Explorer:** <https://explorer-bradbury.genlayer.com>
- **Deployer / owner:** `0x04e0353B7218b66D6803725ce7342E6e1225DB1b`

## Deployed contracts

| Contract | Address | Bytes | Methods | Deploy tx |
|---|---|---|---|---|
| ClimatePolicy | [`0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807`](https://explorer-bradbury.genlayer.com/address/0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807) | 16,829 | 8 | `0x8f704bc3bab2578a5c66981ba922dfb349a65f6817acac475af68d046889f658` |
| ClimateClaim | [`0xb80eC5aEa3A62a5F282DB19bA1ccE311b642bC51`](https://explorer-bradbury.genlayer.com/address/0xb80eC5aEa3A62a5F282DB19bA1ccE311b642bC51) | 19,333 | 16 | `0xf3104e7bf5cea37819ea43c06100fabf12f1a98d0210f8028126410f1a1b2c1c` |

Both ACCEPTED / AGREE / FINISHED_WITH_RETURN. Schemas read back from chain and
committed at `docs/schema/*.bradbury.txt`.

`start_claim` reads the authoritative policy cross-contract from ClimatePolicy,
so claims are permissionless and cannot substitute policy terms. That was
measured: `gl.get_contract_at` needs an `Address` (a string raises `TypeError`),
and a view read inside a write can fail transiently, so callers retry.

## On-chain contents

- **3 sources** — `om_archive_precip` (Open-Meteo ERA5), `nasa_power_precip`
  (NASA POWER), `om_forecast_precip` (Open-Meteo Forecast, for `live` mode)
- **7 policies, 6 active** — `policy-1`..`policy-5` (`historical_simulation`, 5-day
  2024 windows, varied `gt`/`gte`, `unanimous`/`majority`, positive and negative
  coordinates) plus `policy-7` (`live`, Paris, 2026-10-18 → 2026-10-28).
  `policy-6` is retired — retired in error this session, irreversible because
  the contract has no un-retire method; `policy-7` is its identical replacement.
- **5 claims**, each decision **derived by `compute_evaluation`** and then
  recorded verbatim with `record_evaluation`:

  | Claim | Decision | Reason | Observed |
  |---|---|---|---|
  | claim-1 | `confirmed` | `threshold_crossed` | 127 (1.27 mm) |
  | claim-2 | `not_confirmed` | `threshold_not_crossed` | 85 (0.85 mm) |
  | claim-3 | `inconclusive` | `source_conflict` | 107 (1.07 mm) |
  | claim-4 | `inconclusive` | `missing_observations` | 0 |
  | claim-5 | `confirmed` | `threshold_crossed` | 275 (2.75 mm) |

  The engine emits **4 checks** — `threshold_crossed`, `period_covered`,
  `data_completeness`, `source_agreement` — each `pass | fail | unclear`.

## Equivalence design

`compute_evaluation` on ClimatePolicy is pure: unit normalisation, median,
threshold comparison and the agreement rule run in code, never in the LLM.
Consensus-relevant fields are enums plus scaled integers, so validators compare
structure, not prose; a `confirmed` whose `observed_value` does not satisfy the
threshold is rejected as not equivalent. The app and `evaluate-claim.mjs` derive
first and record exactly what came back — no decision is chosen by hand.

**Stated limitation:** the chain makes no web or model call. Evidence rows are
supplied by the caller, so provenance is the caller's claim; consensus
adjudicates the interpretation of that evidence against the policy, it does not
fetch weather. This is documented rather than papered over.

## Gates run this session

- `genvm-lint check contracts/Climate-Claim.py --json` → `"ok":true` (16 methods)
- `genvm-lint check contracts/Climate-Policy.py --json` → `"ok":true` (8 methods)
- `python3.12 -m pytest tests/direct -q` → **33 passed**
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → **27 files, 364 tests passed**
- `npx vite build` → built successfully

No `tests/integration/` directory exists in this repository; that gate is not
claimed.

## Demo

1. Open <https://climate-claim-fawn.vercel.app/> (Historical simulation badge
   is visible in the header).
2. **Policies** — six active policies read live from chain; `policy-7` shows the
   `Live` badge.
3. **Claims** — claim-1..claim-5 with state, decision, reason and observed value.
   Open claim-3 (`inconclusive` / sources disagree) and claim-4 (a source never
   returned) to see inconclusive rendered as a legitimate outcome, not an error.
4. **Claim detail** — per-check results, evidence rows with source and units,
   dispute history, settlement panel.

## Known limitations (honest list)

- Evidence provenance is caller-supplied; no on-chain web fetch (above).
- `aggregation` is stored on the policy but `_evaluate` compares the supplied
  value directly — the value is understood as already aggregated for the period.
- `record_evaluation`'s JSON string cannot pass through the `genlayer` CLI (it
  strips inner double quotes); `frontend/scripts/evaluate-claim.mjs` uses
  genlayer-js instead.
- The deployed contract's module docstring still describes the earlier
  owner-mediated bridge. It is part of the deployed source, so it was left as
  deployed rather than drifted out of sync with the chain.
- Two deployer keys were pasted into chat in earlier sessions and need rotating
  by the owner.
