# ClimateClaim

**A parametric weather claim is only as good as the evidence behind it. ClimateClaim
checks recorded weather observations against a policy written in plain language, and
shows you the readings that produced the answer — including when the honest answer is
"we cannot tell".**

**Live app:** <https://climate-claim-fawn.vercel.app/>
**Network:** GenLayer **StudioNet** (chain 61999, gasless)
**Full submission, proof and reviewer commands:**
[`docs/portal-submission.md`](docs/portal-submission.md)

Deployed as three contracts, all **FINALIZED / MAJORITY_AGREE**:

| Contract | Address | Bytes | Methods |
|---|---|---|---|
| `Climate-Policy.py` | [`0x4014b937482eedff10CE67Af8AF97De592BC15CA`](https://explorer-studio.genlayer.com/address/0x4014b937482eedff10CE67Af8AF97De592BC15CA) | 17,515 | 9 |
| `Climate-Claim.py` | [`0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6`](https://explorer-studio.genlayer.com/address/0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6) | 18,757 | 16 |
| `Climate-Evaluator.py` | [`0xb0766279352537d71A7fE536E0c5b77ab1aa869e`](https://explorer-studio.genlayer.com/address/0xb0766279352537d71A7fE536E0c5b77ab1aa869e) | 19,149 | 2 |

Current on-chain state: **5 sources, `policy-1`, `claim-1` decided
`confirmed` / `threshold_crossed`**, observed **269** (2.69 mm) against a
**1.00 mm** threshold, from Open-Meteo ERA5 (`160`) and NASA POWER (`379`), with
all five checks `pass`. The claim's `get_evaluator()` returns
`0xb0766279352537d71A7fE536E0c5b77ab1aa869e`, and the evaluator's
`get_result("claim-1", 0)` is the result the claim recorded.

**The decision path is consensus, not owner assertion.** `evaluate_for_claim`
fetches every eligible source inside a leader/validator round and stores the
structured result. `sync_evaluation(claim_id)` is permissionless: it reads that
result for the claim's current dispute round, verifies the policy id, version and
period, re-derives the outcome with `ClimatePolicy.compute_evaluation` from the
same evidence rows, and rejects a decision/reason mismatch. The deployed claim
schema has **no `record_evaluation` and no `resolve_dispute`** — there is no
method that lets the owner assert a decision.
Disputes advance the round and require a fresh consensus round. Settlement only
consumes a decision that was already synced and finalized.

Verify it yourself:

```bash
genlayer network set studionet
genlayer call 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_evaluator
genlayer call 0xb0766279352537d71A7fE536E0c5b77ab1aa869e get_result --args "claim-1" 0
genlayer call 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_claim --args "claim-1"
genlayer schema 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6
```

> **What this deployment does and does not do.**
>
> The contracts are split because GenLayer testnets reject a deploy whose source
> exceeds roughly 19 KB, **comments included**. Measured: 18,600 B accepted,
> 20,294 B rejected, and a probe that was 90% comments was rejected too. The
> split is a deployment requirement, not a design preference; see
> [`contracts/README.md`](contracts/README.md).
>
> The evaluator fetches and normalises structured weather records inside
> `gl.vm.run_nondet`; it does **not** send policy text to an LLM. Validators
> re-fetch and compare the decision, reason group, required checks, per-source
> crossing flags and scaled values. Threshold arithmetic is plain code on both
> sides. The LLM-assisted policy-wording design in `archive/` is pre-split
> history and is **not** referenced by any deployed contract.
>
> `finalize_decision` and `settle_claim` are owner-triggered. They cannot choose
> or change an outcome; they only advance a decision that consensus already
> produced. No live payout has been executed on this deployment.

---

## Problem

A parametric claim says *"pay out if it rains more than 1 mm in Paris on 1 June."*
Answering it honestly is harder than it looks:

- **Sources disagree.** ERA5 and MERRA-2 are two respected reanalyses of the same
  day. On 2024-06-04 in London they report **1.10 mm** and **2.03 mm**. One crosses a
  1.50 mm threshold; the other does not. Neither is wrong.
- **Sources fail.** A source can be down, rate-limited, or return a truncated period.
- **The policy needs interpreting.** Which station counts as "the area"? Is a day at
  exactly the threshold a crossing? What does "heavy rainfall" mean when two sources
  differ by 2×?
- **The evidence may describe the wrong place.** Reanalysis sources report the grid
  cell they used, which can be kilometres from the point you asked for.

A single deterministic script reading one API must answer yes or no. It has no honest
way to say "these two sources disagree", and no way to survive a silent partial
response without silently answering wrong.

---

## Why GenLayer

Consensus over evidence, not over bytes. A leader fetches the sources and proposes a
structured result; **validators independently re-fetch the same sources and evaluate
them themselves**. Agreement is on *meaning* under the policy's stated rules.

That buys three things a single script cannot have:

1. **Independent verification.** A leader that mis-parses a response does not get to
   decide the outcome; validators reach their own answer and reject it.
2. **A real `inconclusive`.** When sources genuinely conflict, the honest result is
   that the question is unsettled — and that can be recorded, explained and appealed.
3. **Finality.** A result validators agree on is *accepted*; only after finalisation is
   it *final*, and only then can a payout occur.

Consensus interprets the evidence. **It never invents a reading.** Where deterministic
code can decide — unit conversion, aggregation, the threshold comparator — it is plain
integer code, not the model's job.

---

## Quick start

### The web app

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The app reads **live from StudioNet**. No API key, no wallet needed to read.

```bash
npm run build && npm run preview
npm run capture      # re-capture the on-chain snapshot from the chain
```

### The contract

```bash
pip install -r requirements.txt

# Note: GENVM_VERSION is required. Bare genvm-lint resolves a newer cached
# GenVM and fails to load the pinned SDK.
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Policy.py
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Claim.py
# Python 3.12+ required (genlayer_py needs collections.abc.Buffer).
python3.12 -m pytest tests/direct/ -q          # 39: config drift + address coercion
python3.12 -m pytest archive/tests -q          # 170: the pre-split contract
```

### Read the deployed contracts

```bash
genlayer network set studionet

# Policy contract: sources, policies, pure evaluation
genlayer schema 0x4014b937482eedff10CE67Af8AF97De592BC15CA
genlayer call   0x4014b937482eedff10CE67Af8AF97De592BC15CA list_policies
genlayer call   0x4014b937482eedff10CE67Af8AF97De592BC15CA list_sources

# Evaluator: source-fetching consensus round + stored result
genlayer schema 0xb0766279352537d71A7fE536E0c5b77ab1aa869e
genlayer call   0xb0766279352537d71A7fE536E0c5b77ab1aa869e get_result --args "claim-1" 0

# Claim contract: claims, disputes, settlement, evaluator link
genlayer schema 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6
genlayer call   0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_evaluator
genlayer call   0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_claim --args "claim-1"

# The claim's deploy, on the explorer
genlayer receipt 0x8a9af0f83ecde0dc739890ed61a2d3dabbd0def03a3cf1b3ca80c1af4794d9fd
```

### Seed a fresh deployment's source registry

The contract **seeds no sources itself** — its registry starts empty and holds
only what an owner registers through `register_source`. A brand-new deployment
therefore cannot create any policy until the documented sources are added:

```bash
./scripts/seed-sources.sh <contract-address>   # reads docs/sources.json
```

`register_source` is owner-only, so this must run from the deploying account.
Until it is run, every `create_policy` reverts with `EXPECTED: unknown source`.

---

## What is on chain right now

StudioNet, read back on 2026-10-25:

| Item | Value |
|---|---|
| Policy | `policy-1` — Paris, France, precipitation `gt` 1.00 mm, 2024-06-01 → 2024-06-05, `historical_simulation`, unanimous, 2 sources |
| Claim | `claim-1` — same period, state `decided_confirmed` |
| Consensus result | `confirmed` / `threshold_crossed`, observed `269` (2.69 mm) |
| Sources used | Open-Meteo ERA5 `160`; NASA POWER `379` (scaled ×100) |
| Checks | `threshold_crossed`, `period_covered`, `location_match`, `source_agreement`, `data_completeness` — all `pass` |
| Rounds | evaluation round `1`; dispute rounds `0`; not finalized; not settled |

The three transactions that produced this state are all **FINALIZED /
MAJORITY_AGREE**: `start_claim`
[`0x1a5e007f…aa7dc592`](https://explorer-studio.genlayer.com/tx/0x1a5e007ff08ab7beb0ab14dd48458e3401a202e5e009d92b08679391aa7dc592),
`evaluate_for_claim`
[`0xc3864051…2ba0675`](https://explorer-studio.genlayer.com/tx/0xc3864051040577a21e411a18dc75a20f81cf8308f1f07173d5f5710482ba0675),
and `sync_evaluation`
[`0xac4629ab…920ccf8`](https://explorer-studio.genlayer.com/tx/0xac4629ab10ba9baa4fd8e01d0fa07b1f39e0976db440f9509b8998f4e920ccf8).
The full read-back and reviewer commands are in
[`docs/portal-submission.md`](docs/portal-submission.md).

The earlier Bradbury deployment and the older StudioNet v2 run are retained as
historical evidence under [`artifacts/`](artifacts/) and
[`docs/deployment-bradbury-2026-10-18.md`](docs/deployment-bradbury-2026-10-18.md).
They are **not** what the live app points at.

---

## How it works

```
Policy Registry ──► Claim ──► Evidence ──► Evaluation ──► Decision ──► (dispute) ──► Settlement
  location          the claim's per source     leader +        confirmed     re-evaluate    two-phase,
  period            OWN window    records     validators      not_confirmed   eval_round     finality-gated,
  threshold     (frozen sources                              inconclusive    += 1 on a      no balance
  aggregation    are snapshotted                                                recorded       inference
  eligible sources at creation)                                                   outcome
  data mode
```

### State machine

```
created ──► evidence_collected ──► pending_evaluation ──┬─► decided_confirmed
                                                        ├─► decided_not_confirmed
                                                        └─► inconclusive
                                                              │
        decided_* / inconclusive ──► disputed ──► (re-evaluate; eval_round += 1
                                                    only when an outcome is recorded)
        decided_confirmed ──► payout_emitted ──► settled   (finality, then verified
                                                              delivery — emission
                                                              alone is not payment)
```

Every transition is documented in [`docs/state-diagram.md`](docs/state-diagram.md) and
tested valid **and** invalid in `tests/direct/test_state_machine.py`.

### Why three contracts

GenVM allows one `gl.Contract` per module, and both GenLayer testnets reject a
deploy whose source exceeds roughly 19 KB. The four responsibilities are split
along the natural trust boundary:

- **ClimatePolicy** — registry, immutable policy snapshots, and the pure
  `compute_evaluation` function (no web, no model, no clock).
- **ClimateEvaluator** — the non-deterministic half: fetch eligible sources in
  `gl.vm.run_nondet`, normalise, compare, reach equivalence, store the result.
- **ClimateClaim** — claim state, disputes, finalization, and settlement. It
  reads the evaluator's stored result and re-derives the decision with
  `ClimatePolicy.compute_evaluation` before recording it.

Settlement is separate from evaluation and cannot change a decision. See
[`contracts/README.md`](contracts/README.md) and
[`docs/equivalence.md`](docs/equivalence.md).

---

## Equivalence design

The full design is in [`docs/equivalence.md`](docs/equivalence.md). The short version —
`evaluate_for_claim` is the single non-deterministic call, and two validator results are
treated as equivalent when:

- the **decision** matches exactly;
- the **reason code** matches, or falls in a documented equivalence group;
- every **required check** matches — `threshold_crossed`, `period_covered`,
  `data_completeness` (supporting checks `location_match` and `source_agreement` may
  differ);
- the **observed value** is within a documented tolerance **and sits on the same side
  of the threshold as the decision**;
- **location is authoritative**: a definite decision may not carry a failing location
  check on either side, so a `confirmed` can never sit on top of a location failure.

That last pair is deliberate: a validator will not accept a `confirmed` whose own
numbers fail the threshold, nor one whose location evidence contradicts it.

Two more rules earn their keep, and both exist because the honest answer is not a
binary one:

- Under the `majority` rule an **equal split is `inconclusive` / `source_conflict`**,
  never a silent `not_confirmed`.
- A provider response that **repeats a date** fails that source
  (`EXTERNAL: duplicate_dates`) instead of inflating coverage or double-counting a
  total.

`strict_eq` is never used on free-form model text.

### What the model does, and what it does not

| Deterministic code | Model interpretation |
|---|---|
| Unit conversion, aggregation, comparator | Whether a station matches the policy location **when the provider reports no coordinates** (with coordinates, the integer proximity check is authoritative) |
| Period boundaries, gap detection | Ambiguous policy wording |
| Threshold comparison on extracted numbers | A one-sentence plain-language summary |
| Reason code and decision | |

The model is never asked for the decision or for a threshold value: the decision,
reason code and `observed_value_scaled` are computed in deterministic code and
passed *to* the prompt as `COMPUTED …` fields. The only enum it supplies is
`location_match` (`pass`/`fail`/`unclear`), plus a one-sentence summary. It is
never asked to do arithmetic and cannot fill a gap. Its output is schema-validated,
enum-coerced and range-checked before use, and an unusable reply degrades the
location check to `unclear` rather than inventing a reading.

---

## Settlement

Deliberately conservative, and **two-phase**, because on GenLayer an emitted
message is not a delivery: the value leaves this contract when the message is
emitted and reaches the recipient only when the message's *child transaction*
activates, which happens after this transaction finalizes and can still fail.

```
not_settled ──settle_claim──► payout_emitted ──confirm_settlement──► settled
                                    │  └────fail_settlement─────► settlement_failed
                                    └──__on_errored_message__────► settlement_failed
                                                                   (retryable)
```

1. Evaluation and settlement are separate. Settlement never calls a model.
2. A payout requires the contract's own `finalized` flag — the `LATEST_FINAL`
   snapshot must match the decision, the reason code **and** the evaluation round,
   so a dispute re-evaluation that repeats the old decision can never be marked
   final on the strength of the previous round's snapshot. An
   accepted-but-appealable decision is refused.
3. `settle_claim` emits the payout and moves the claim to `payout_emitted` — never
   straight to `settled`. The single in-flight slot is claimed before the message is
   emitted, so a claim has at most one payout in flight and a re-issued call is
   rejected; `confirm_settlement` (after the operator verifies the child
   transaction's receipt) is the only path to `settled`.
4. Success is recorded from the message's own outcome, never inferred from a
   recipient's balance. A failed emit reverts the whole transaction; a failed child
   transaction is refunded through `__on_errored_message__`, which marks the claim
   `settlement_failed` (retryable) when exactly one payout is in flight and merely
   records the refund when attribution would be a guess.
5. Amounts are sized integers. A failure lands in `settlement_failed`, never a
   silent "settled", and `get_settlement` exposes `in_flight` so the UI cannot
   render an unverified payout as paid.
6. **Who gets paid:** the policy's `beneficiary`. `create_policy` defaults it to the
   policy owner, `set_beneficiary` may change it before any claim references the
   policy, and the **zero address** is the documented opt-in for "pay the claim's
   claimant". Paying a claimant is never a silent default.

> Status: this lifecycle is proven by the direct suite
> (`tests/direct/test_settlement.py`, plus the settlement sections of
> `test_contract_audit.py`), not yet by a live transfer. No claim is settled.

---

## Data sources

Registry with URLs, fields, units, quirks and failure behaviour:
[`docs/sources.md`](docs/sources.md). All are open, key-free, and documented.

| Source | Variable | Unit | Grid |
|---|---|---|---|
| Open-Meteo Historical (ERA5) | `precipitation_sum`, `temperature_2m_max` | mm, °C | ~9 km |
| NASA POWER Daily v2 (MERRA-2) | `PRECTOTCORR`, `T2M_MAX` | mm/day, °C | coarser |

They legitimately disagree. That is the point.

**Historical simulation vs live.** `data_mode` selects the retrieval path rather
than being a label: `historical_simulation` accepts only archive sources and a
window entirely in the past, `live` accepts only the live source and a window that
reaches today, and `create_policy` rejects a policy whose sources do not match its
mode. Be precise about what the first one means: it is a **fresh retrieval of
archived observations**, not a frozen dataset, so a provider revising its own
history would show up. It is never presented as live, and the origin badge always
states whether a screen is showing live chain reads or a recorded snapshot.

---

## The app

Screens and design rationale: [`UI.md`](UI.md).

The **Evidence Chart** is the centrepiece: per-source readings against the policy
threshold, with missing days as hatched gaps and source disagreement flagged where it
happens. Sources are distinguished by **shape as well as colour**, so the chart stays
readable without colour vision.

Honesty rules the UI enforces:

- reads and writes behave differently; writes show a full lifecycle;
- **accepted is never shown as final** — two distinct chips, everywhere;
- `inconclusive` is presented as a result with an explanation, never an error;
- the origin badge says whether data is live or a recorded snapshot, including while
  a live read is still in flight;
- explorer links are built from verified routes (`/tx/<hash>`) and shown **disabled
  with a reason** if an explorer is down, rather than as dead links;
- contract error prefixes map to actionable messages, with the stable string behind a
  "Details" disclosure;
- every claim exports its **audit receipt as JSON** (policy, evidence, checks, decision,
  disputes, settlement) with its own provenance block — record origin (live / mixed /
  recorded snapshot), snapshot capture time, network, contract address and the session's
  transaction link — assembled from the same data the page renders, so nothing can be
  exported that the screen did not show.
- the claim page also **prints as a receipt**: a print stylesheet drops the chrome,
  buttons and the actions panel, forces the light palette, keeps panels whole across
  page breaks and adds a print-only line with the timestamp, contract address and
  network;
- the claims table **filters by decision and state**, searches by id, and **paginates**
  (8 rows/page) — all pure functions with unit tests, so the table stays usable at
  hundreds of claims;
- a **route-level error boundary** keeps a crashed page from white-screening the app:
  the fallback offers *Try again* while the header and every other route stay usable;
- the demo page puts a **per-day source comparison table** beside the chart when two or
  more sources are shown (spread per day, disagreement days named explicitly), and for
  the conflicting-sources scenario a **"what a deterministic chain would have said"**
  panel sets the pass/fail each single hard-wired source would force against the
  contract's honest *inconclusive*;
- the evidence chart's screen-reader label is short, and **every data point is
  keyboard-focusable** (arrow keys / Home / End) with its own label;
- the selected **language lives in the URL** (`?lang=fr`), so
  `/demo?scenario=conflict&lang=fr` opens exactly that scenario in French — a supported
  `?lang=` wins over the stored preference on load, and every locale change updates the
  address bar.

**Demo mode** (`/demo`) walks eight scenarios — threshold crossed, not reached,
exactly at the threshold, conflicting sources, missing observations, location mismatch,
repeated attempt, dispute round. Each is badged either *real on-chain claim* or *replay
of recorded data*, and each names the direct test that pins its outcome. A replay is
never dressed up as a transaction.

Because the public RPC is limited to 30 requests/minute, the app paints the recorded
snapshot immediately and transparently upgrades to live chain data, labelling which is
on screen at each moment.

Screenshots: [`artifacts/screenshots/`](artifacts/screenshots/).

### Deploying the app to Vercel

The app is a static single-page bundle, so it deploys as-is. The contract is **not**
deployed by Vercel — `vercel.json` only builds and serves `frontend/`.

**Dashboard route:** open <https://vercel.com/new>, import this repository and press
Deploy. Leave **Root Directory** at the repository root; the settings live in
[`vercel.json`](vercel.json), which runs the build in the frontend subdirectory:

| Vercel setting | Value |
| --- | --- |
| Install Command | `cd frontend && npm ci` |
| Build Command | `cd frontend && npm run build` |
| Output Directory | `frontend/dist` |

The `rewrites` entry is what makes `react-router` deep links work. The app is a
`BrowserRouter` SPA, so `/claims/claim-5` is not a file on disk; the rewrite sends it
to `index.html` and lets the client route it. Vercel checks the filesystem *before*
applying a rewrite, so hashed assets under `/assets/` are still served directly.

If the import flow instead sets **Root Directory** to `frontend/` (the Vercel
UI's default for this repository), that works too: keep it, and Vercel reads the
same rewrite from [`frontend/vercel.json`](frontend/vercel.json), which is
committed for exactly that setup. The one arrangement that breaks deep links is
Root Directory = `frontend/` with no config inside it: no rewrite is applied, so
every direct load of a deep link (`/claims`, `/how-it-works`, a hard reload)
answers Vercel's 404 while in-app navigation still looks fine — observed on
2026-10-16 on `climate-claim-fawn.vercel.app`.

**CLI route:** `npx vercel --prod` **from the repository root** (running it from
`frontend/` makes Vercel treat that directory as the project root; the rewrite
then comes from `frontend/vercel.json`, not the repository-root file).

Three things worth knowing before you trust the deployed site:

1. **Env vars are optional; the typed config is the fallback.** The chain, contract
   address and explorer URL come from typed config files
   (`frontend/src/config/`). A deployment *may* override three of them from the
   repository-root `.env` (`VITE_CLIMATECLAIM_ADDRESS`, `VITE_GENLAYER_RPC_URL`,
   `VITE_GENLAYER_CHAIN_ID`, `VITE_GLTEST_NETWORK`) — see
   [Configuration](#configuration) below. Unset or malformed values fall back to
   the literals, so the app builds and runs identically with no `.env` at all.
   **There are still no secrets in the app.**
2. **Reads work immediately; writes need a browser wallet.** The StudioNet RPC was
   checked against a deployment origin and answers with
   `access-control-allow-origin`, so the deployed page can read the chain directly.
   Sending a transaction requires an injected wallet, which holds its own key.
3. **The recorded deployment predates the latest contract changes.**
   `frontend/src/config/contracts.ts` points at the v2 StudioNet address, whose
   contract lacks the new settlement and dispute methods; the owner-only payout
   panel will fail against it until the contract is redeployed and that address is
   updated. The staleness note in `contracts.ts` names the exact methods.

---

## Configuration

Every value is optional. `frontend/src/config/network.ts` and `contracts.ts` hold
typed literals that are always correct for the recorded deployment, and the
repository-root `.env` (gitignored, copied from [`.env.example`](.env.example))
can override four of them. The example ships with all four public values already
filled in, so a fresh clone needs no editing — only the deploy key must be
supplied locally.

| Variable | Overrides | Typed fallback |
|---|---|---|
| `VITE_CLIMATECLAIM_ADDRESS` | `CONTRACT_ADDRESS` | `0x6E4B…ea8` in `contracts.ts` |
| `VITE_GENLAYER_RPC_URL` | StudioNet `rpcUrl` | `https://studio.genlayer.com/api` |
| `VITE_GENLAYER_CHAIN_ID` | StudioNet `chainId` | `61999` |
| `VITE_GLTEST_NETWORK` | `ACTIVE_NETWORK` | `studionet` |

Explorer URLs, network labels and the explorer-availability flags are **not**
overridable: they encode verified facts about each chain rather than
per-deployment settings.

Invalid input degrades rather than breaks — a malformed address, a non-integer
chain id or an unknown network key each fall back to the typed literal, so a bad
`.env` cannot produce a blank page or an opaque RPC error.

### The deploy key never reaches the browser

`.env` holds `VITE_DEPLOYER_PRIVATE_KEY`, a funded StudioNet deploy key. It is
**not** one of the four injected values, and this is enforced structurally rather
than by convention:

- `frontend/vite.config.ts` sets `envPrefix: "VITE_PUBLIC_"`, which matches no
  variable in `.env`. Nothing from the root `.env` reaches `import.meta.env`, so
  even a whole-object reference like `JSON.stringify(import.meta.env)` cannot
  inline it. (With the stock `VITE_` prefix, that expression inlines *everything*,
  key included.)
- Each public value is injected through an explicit `define` entry, listed in
  `PUBLIC_ENV_VARS`. A value only reaches the browser if added to that list.

`tests/direct/test_env_consistency.py` asserts both properties, so widening the
prefix or adding the key to the list fails the suite rather than leaking quietly.

The key is also the one value `.env.example` does **not** ship filled in. That
file is committed, so a real key there would be published permanently — git
history keeps it after any later removal and it reaches every clone and remote.
The four public values are filled in; `test_env_example_carries_no_secret` fails
if a key-shaped value ever appears there.

### Keeping the sources in sync

The same deployment facts are recorded in four places: `.env`, `.env.example`,
`gltest.integration.config.yaml` and the frontend's typed fallbacks. Nothing
enforces agreement by default, so `test_env_consistency.py` checks it — the suite
fails if the RPC URL, chain id, address or network key drift apart. Both env
files are checked, so a stale committed example is caught too; when `.env` is
absent (as on CI) only `.env.example` is checked and nothing is skipped.

> `scripts/capture-studionet-readonly.sh` deliberately pins the **v1** address
> rather than reading `.env`, because the committed evidence pack was captured
> against that deployment.

---

## Language and theme

The app ships in **English, Spanish, French and German**, with a light and a dark
theme.

### Language

Pick a language from the control in the header. The choice is remembered in
`localStorage`; on a first visit the app negotiates from your browser's languages
(`es-419` resolves to Spanish, and so on). Each language is labelled in **itself**
— "Español", "Français", "Deutsch" — because a switcher reading "Spanish" is
useless to someone who only reads Spanish.

Every user-visible string lives in `src/i18n/locales/`. `en.ts` is the source of
truth and `MessageKey` is derived from it, so every other locale is typed as
`Record<MessageKey, string>`:

```ts
export const fr: Dictionary = { /* every key, or this will not compile */ }
```

That is deliberate. **A missing translation is a compile error**, not a silent
fall-back to English — which is the failure mode that makes a multi-language app
worse than an English-only one, namely a screen half in Spanish and half in
English. `src/i18n/i18n.test.ts` additionally asserts that all four locales use
the same `{placeholder}` set, which the type system cannot catch.

Contract enums (decisions, reason codes, check statuses, claim states) are mapped
in `domain/copy.ts`, which now reads through `t()` while keeping its exported API
unchanged. Raw enum values are still never rendered to a user.

### Theme

The control cycles **System → Light → Dark**. "System" follows your OS setting and
keeps following it if you change it mid-session; an explicit choice sticks. The
choice is remembered, and an inline script in `index.html` applies it *before
first paint* so a dark-theme visitor never gets a white flash.

Theming is a token override, not a second stylesheet. `src/styles/global.css`
already expressed everything through `--` design tokens, so the dark theme is a
single `[data-theme="dark"]` block redefining 20 of them. Accents are **lightened**
rather than dimmed, because a dimmed accent on a dark field loses the contrast it
has on paper.

Two extra tokens, `--on-accent` and `--on-alert`, exist because dark mode lightens
the accents: white text on a lightened blue would fail contrast, so the
text-on-fill colour is a token in both themes. Every colour pair in both themes
was checked against WCAG AA.

> Known pre-existing issue: in the **light** theme, `--amber-flag` on white
> measures 3.59:1, below the 4.5:1 AA threshold for body text. It predates this
> work and was not changed, since it is a brand-colour decision. Darkening the
> light amber to about `#9c650a` would pass.

---

## Testing

```bash
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Policy.py        # 7 methods
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Claim.py   # 16 methods
python3.12 -m pytest tests/direct/ -q   # 33 passed: env/yaml/frontend drift checks
python3.12 -m pytest archive/tests -q   # 170 passed: archived pre-split contract
cd frontend && npm test && npx tsc -b --noEmit && npm run build          # 148 unit tests (10 files) + typecheck + build
```

> The contract suite needs **Python 3.12+** (`genlayer_py` imports
> `collections.abc.Buffer`, added in 3.12). On a box whose default `python3` is
> 3.10, use `python3.12 -m pytest` explicitly.

The direct suite mocks web and LLM so it is fast and deterministic. It covers the
adversarial cases: threshold boundaries (`>` at exactly the threshold), all four
aggregation rules, conflicting sources, missing days and empty bodies with **no
interpolation**, location mismatch, out-of-period readings, unit mismatch and
unsupported units, source failures and malformed payloads, every valid and invalid
state transition, duplicate claims, dispute limits, settlement idempotency, and
prompt-injection fixtures.

`tests/direct/test_contract_audit.py` is organised as one section per contract-audit
finding — claim-scoped windows, frozen and final source registrations, data-mode
enforcement, dispute counting with recovery from a failed re-evaluation,
round-specific finality, majority ties, duplicate dates, the aggregation/unit
rules, location authority and the source listing — so a regression in any of them
fails a test that names it.

---

## Limitations

Stated plainly:

1. **Explorer links depend on the official StudioNet explorer.** Links point at
   `https://explorer-studio.genlayer.com/tx/<hash>` (verified serving on 2026-10-16);
   if it is ever paused again, the UI disables them with a reason instead of linking
   to a dead page.
2. **StudioNet is a test network.** It is gasless and holds no real funds. The
   current deployment has **not executed a live payout**: `claim-1` is
   `decided_confirmed` but not finalized or settled. `finalize_decision` and
   `settle_claim` are owner-triggered; they cannot select or change the decision,
   only advance one that consensus already produced.
3. **No integration tests.** `tests/integration/` does not exist. On-chain
   behaviour was verified by real writes against StudioNet: three deploys, one
   policy, one claim, one consensus evaluation and one sync, with receipts and
   read-backs recorded in
   [`docs/portal-submission.md`](docs/portal-submission.md).
4. **The deployed evaluator does not use an LLM.** It fetches structured weather
   records from Open-Meteo and NASA POWER, normalises them, and compares the
   derived decision/checks/values under validator equivalence. Policy wording is
   already compiled into the frozen policy snapshot. The LLM-assisted design in
   `archive/climateclaim.py` is pre-split history and is **not deployed**; its
   170 tests cover code that is not on chain.
5. **The three deployed contracts do not have a full per-method direct suite.**
   `tests/direct/` currently has 39 tests covering config drift and Studio's
   uint160 address encoding. Contract behaviour is evidenced by the on-chain
   receipts and read-backs, not by a mocked unit suite for every method.
6. **Reanalysis, not station observations.** Open-Meteo ERA5 and NASA POWER are
   modelled grids, smoother and more complete than a real rain gauge. Grid cells
   are not points; a tight distance tolerance can produce `inconclusive` by design.
7. **Historical simulation, not live weather.** `claim-1` covers a 2024 period and
   is labelled `historical_simulation`. Live mode is supported by the source kind
   but is not demonstrated by the current on-chain claim.

---

## Evidence

- Deployment record, on-chain claims, transaction hashes, receipts, screenshots and
  known gaps: **[`artifacts/DEPLOYMENT.md`](artifacts/DEPLOYMENT.md)**
- Screenshots: [`artifacts/screenshots/`](artifacts/screenshots/)
- Saved contract schema: [`docs/schema.json`](docs/schema.json) — captured from the
  earlier deployment, so it documents that contract, not the current source
- Design docs: [`docs/equivalence.md`](docs/equivalence.md),
  [`docs/state-diagram.md`](docs/state-diagram.md), [`docs/sources.md`](docs/sources.md)
- Fixtures: [`fixtures/historical/`](fixtures/historical/)
- Session history: [`CHANGELOG.md`](CHANGELOG.md)

---

## Credits

- [GenLayer](https://genlayer.com) and the
  [GenLayer docs](https://docs.genlayer.com) — Intelligent Contracts, equivalence
  principle, StudioNet.
- [`genlayer-js`](https://www.npmjs.com/package/genlayer-js) v1.1.8 — the SDK the app
  reads through, and the source of the verified chain definitions and transaction
  statuses used here.
- [Open-Meteo](https://open-meteo.com) (CC BY 4.0) and
  [NASA POWER](https://power.larc.nasa.gov) (open data) — the weather sources.
- [Atkinson Hyperlegible Next](https://brailleinstitute.org/freefont) and
  [Literata](https://fonts.google.com/specimen/Literata) — typography, served from
  Google Fonts with system fallbacks.
- Build rules: [`AGENTS.md`](AGENTS.md), [`Prompt.md`](Prompt.md), [`UI.md`](UI.md).

### Starters consulted (patterns, not vendored code)

No starter repository code was vendored. The contract, tests, fixtures and app were
written for this project against the GenLayer docs and the verified SDK. These
official starters informed the structure and the evidence-fetch / resolution
patterns, and are credited here per the build rules:

- [GenLayer Project Boilerplate](https://github.com/genlayerlabs/genlayer-project-boilerplate)
  — the contract + frontend layout this repo adapts (separate `contracts/`,
  `tests/`, `frontend/`, `docs/`).
- [GenLayer Gym](https://gym.genlayer.foundation/) — web-access source and
  evaluation patterns; informed the "fetch structured facts, then evaluate"
  split and the source registry in `docs/sources.md`.
- [Intelligent Oracle](https://www.intelligentoracle.com/) — oracle / consensus
  patterns; informed the leader-plus-validator equivalence design in
  `docs/equivalence.md`.
- [Prediction Market Kit](https://github.com/courtofinternet/pm-kit) — outcome
  resolution flows; informed the claim state machine and the
  accepted-vs-finalized distinction in `docs/state-diagram.md`.

No starter repository code was vendored. The contract, tests, fixtures and app were
written for this project against the GenLayer docs and the verified SDK.