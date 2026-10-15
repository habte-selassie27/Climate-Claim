# ClimateClaim

**A parametric weather claim is only as good as the evidence behind it. ClimateClaim
checks recorded weather observations against a policy written in plain language, and
shows you the readings that produced the answer — including when the honest answer is
"we cannot tell".**

Deployed on GenLayer StudioNet at
[`0x6E4BD06bD969E745546A7957d818eDaD47882ea8`](artifacts/DEPLOYMENT.md)
(deploy tx
`0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f`,
consensus 5/5 AGREE). The earlier v1 deployment
(`0xE16032420e3155C0822e9150a98c6B1163869F0c`) and its artifacts are preserved
under [`artifacts/deployment-v1/`](artifacts/deployment-v1/).

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
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py
# Python 3.12+ required (genlayer_py needs collections.abc.Buffer).
python3.12 -m pytest tests/direct/ -q
```

### Read the deployed contract

```bash
genlayer network set studionet
genlayer schema 0x6E4BD06bD969E745546A7957d818eDaD47882ea8
genlayer call 0x6E4BD06bD969E745546A7957d818eDaD47882ea8 get_claim --args claim-2
genlayer receipt 0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f
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

> **The deployment below predates the audit fixes.** Every claim, receipt and
> schema under `artifacts/` and [`docs/schema.json`](docs/schema.json) was captured
> from the v2 contract as it stood then; the contract source has since changed
> (criteria version `climateclaim-criteria-2`). The recorded evidence is kept
> as-is because it is real, but the deployment must be **redeployed and
> re-captured** before its schema is used to wire the app. The differences are
> listed in [`CHANGELOG.md`](CHANGELOG.md).

Six real claims, all readable, all reproduced in
[`artifacts/DEPLOYMENT.md`](artifacts/DEPLOYMENT.md):

| Claim | Policy | Decision | Why | Evidence |
|---|---|---|---|---|
| `claim-1` | 1 | *evaluation failed* | `EXTERNAL: sources_unreachable` | NASA POWER unreachable; retryable |
| `claim-2` | 3 | **Not confirmed** | `threshold_not_crossed` | 0.90 mm vs `> 1.00 mm`, station `48.8928,2.2920` |
| `claim-3` | 2 | *not evaluated* | state `created` | demonstrates the start of the lifecycle |
| `claim-4` | 4 | **Inconclusive** | `location_mismatch` | grid cell ~5 973 m away, outside a 5 km tolerance |
| `claim-5` | 5 | **Not confirmed** | `threshold_not_crossed` | 0.90 mm vs `> 5.00 mm` |
| `claim-6` | 7 | **Not confirmed** | `threshold_not_crossed` | 0.90 mm vs `> 1.00 mm` (payout configured) |

`claim-4` is the interesting one. It was *expected* to be `not_confirmed` and instead
became `inconclusive`, because Open-Meteo answered the Paris request with a grid cell
~5 973 m away — outside that policy's 5 km tolerance but inside policy-3's 12 km. The
distance rule alone flips the outcome, and the contract said so instead of guessing.

**Why `claim-2` is `not_confirmed`, not `confirmed`.** The live Open-Meteo archive
returns a maximum of **0.90 mm** for Paris 2024-06-01..05 at the time of this
seeding (reanalysis data is periodically revised; the earlier v1 deployment recorded
1.20 mm for the same window). Nothing was adjusted to force a pass: against a
`> 1.00 mm` threshold, 0.90 mm honestly does not cross, so the claim is
`not_confirmed`. A claim that the real reading *does* cross (a `> 0.50 mm` policy)
is the intended `confirmed` + settlement demonstration and is pending the owner's
keystore to run `finalize_decision` / `settle_claim` on chain.

**No claim is finalized.** All six report `finalized: false`, so the UI shows
*Accepted — can still be appealed* and never claims finality it cannot demonstrate.

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

### Why one contract

GenVM allows one `gl.Contract` per module. The four responsibilities (policy registry,
evidence evaluator, claim state machine, settlement controller) are clearly sectioned
inside a single deployed contract rather than split across cross-contract calls, which
would add moving parts without improving testability.

---

## Equivalence design

The full design is in [`docs/equivalence.md`](docs/equivalence.md). The short version —
`request_evaluation` is the single non-deterministic call, and two validator results are
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
- explorer links are shown **disabled with a reason** when the explorer is paused,
  rather than as dead links;
- contract error prefixes map to actionable messages, with the stable string behind a
  "Details" disclosure.

**Demo mode** (`/demo`) walks eight scenarios — threshold crossed, not reached,
exactly at the threshold, conflicting sources, missing observations, location mismatch,
repeated attempt, dispute round. Each is badged either *real on-chain claim* or *replay
of recorded data*, and each names the direct test that pins its outcome. A replay is
never dressed up as a transaction.

Because the public RPC is limited to 30 requests/minute, the app paints the recorded
snapshot immediately and transparently upgrades to live chain data, labelling which is
on screen at each moment.

Screenshots: [`artifacts/screenshots/`](artifacts/screenshots/).

---

## Testing

```bash
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py   # 3 lint checks + SDK validation
python3.12 -m pytest tests/direct/ -q                                 # 180 direct tests
cd frontend && npm test && npx tsc -b --noEmit && npm run build          # unit tests + typecheck + build
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

1. **The StudioNet explorer is paused.** Transaction links cannot be verified, so the
   UI disables them with a reason instead of linking to a dead page.
2. **No claim is finalized or settled yet, and the deployed contract is older than
   the source.** The v2 deployment created policies 7 and 8 with a real
   `payout_amount` (1,000,000 wei) and the recorded claims exercise evaluation,
   disputes and settlement states, but `finalize_decision` / `settle_claim` /
   `confirm_settlement` have not been run against a deployment — they are
   owner-only. The two-phase settlement lifecycle is implemented and unit-tested
   but **not yet demonstrated by a live transfer**, and the recorded deployment
   predates the audit fixes described in the changelog. A redeploy is required
   before the on-chain evidence matches the current source.
3. **No integration tests.** `tests/integration/` does not exist. On-chain behaviour
   was verified by real writes against StudioNet (deploy, 7 policies, 7 claims,
   5 evaluations — receipts under `artifacts/studionet-v2/`) rather than by an
   integration suite.
4. **StudioNet only.** No Bradbury/Asimov deployment, so no public-proof address.
   The configured chain ids for those testnets were not independently verified
   against the docs in this pass.
5. **The observed reading moved between deployments.** The live Open-Meteo archive
   now returns max 0.90 mm for Paris 2024-06-01..05, where the v1 deployment
   recorded 1.20 mm. Reanalysis data is revised over time. This is why the current
   `claim-2` / `claim-5` / `claim-6` are `not_confirmed` rather than the earlier
   mixed result — the honest outcome for the data as it stands today.
6. **Grid cells are not points.** A tight distance tolerance produces `inconclusive`
   by design. That is correct behaviour, but it surprises people who expect a single
   location answer.
7. **Reanalysis, not station observations.** These are modelled grids, smoother and
   more complete than a real rain gauge.

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