# ClimateClaim

**A parametric weather claim is only as good as the evidence behind it. ClimateClaim
checks recorded weather observations against a policy written in plain language, and
shows you the readings that produced the answer — including when the honest answer is
"we cannot tell".**

Deployed on GenLayer StudioNet at
[`0xE16032420e3155C0822e9150a98c6B1163869F0c`](artifacts/DEPLOYMENT.md).

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
pytest tests/direct/ -q
```

### Read the deployed contract

```bash
genlayer network set studionet
genlayer schema 0xE16032420e3155C0822e9150a98c6B1163869F0c
genlayer call 0xE16032420e3155C0822e9150a98c6B1163869F0c get_claim --args claim-2
genlayer receipt 0x1b87c46dbcae997058539638e36df6b921658c97a8eb305990399ab7a753d0e1
```

---

## What is on chain right now

Five real claims, all readable, all reproduced in
[`artifacts/DEPLOYMENT.md`](artifacts/DEPLOYMENT.md):

| Claim | Decision | Why | Evidence |
|---|---|---|---|
| `claim-1` | *evaluation failed* | `EXTERNAL: sources_unreachable` | NASA POWER unreachable; retryable |
| `claim-2` | **Confirmed** | `threshold_crossed` | 1.20 mm vs `> 1.00 mm`, station `48.8928,2.2920` |
| `claim-3` | *not evaluated* | state `created` | demonstrates the start of the lifecycle |
| `claim-4` | **Inconclusive** | `location_mismatch` | grid cell 5 973 m away, outside a 5 km tolerance |
| `claim-5` | **Not confirmed** | `threshold_not_crossed` | 1.20 mm vs `> 5.00 mm` |

`claim-4` is the interesting one. It was *expected* to be `not_confirmed` and instead
became `inconclusive`, because Open-Meteo answered the Paris request with a grid cell
5 973 m away — outside that policy's 5 km tolerance but inside policy-3's 12 km. The
distance rule alone flips the outcome, and the contract said so instead of guessing.

**No claim is finalized.** All five report `finalized: false`, so the UI shows
*Accepted — can still be appealed* and never claims finality it cannot demonstrate.

---

## How it works

```
Policy Registry ──► Claim ──► Evidence ──► Evaluation ──► Decision ──► (dispute) ──► Settlement
  location          state      per source     leader +        confirmed      re-evaluate    idempotent,
  period                          records       validators      not_confirmed  round += 1     finality-gated
  threshold                                                          inconclusive
  aggregation
  eligible sources
  data mode
```

### State machine

```
created ──► evidence_collected ──► pending_evaluation ──┬─► decided_confirmed
                                                        ├─► decided_not_confirmed
                                                        └─► inconclusive
                                                              │
        decided_* / inconclusive ──► disputed ──► (re-evaluate, round += 1) ──┘
        decided_confirmed ──► settled   (only after finality)
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
  of the threshold as the decision**.

That last clause is deliberate: a validator will not accept a `confirmed` whose own
numbers fail the threshold, so validators cannot agree on something plainly wrong.

`strict_eq` is never used on free-form model text.

### What the model does, and what it does not

| Deterministic code | Model interpretation |
|---|---|
| Unit conversion, aggregation, comparator | Whether a reported station is the policy location |
| Period boundaries, gap detection | Ambiguous policy wording |
| Threshold comparison on extracted numbers | A one-sentence plain-language summary |
| Reason code and decision | |

The model is told to return `inconclusive` when evidence is insufficient, is never
asked to do arithmetic, and cannot fill a gap. Its output is schema-validated,
enum-coerced and range-checked before use.

---

## Settlement

Deliberately conservative, and currently **undemonstrated on chain** — every policy was
created with `payout_amount: 0`.

1. Evaluation and settlement are separate. Settlement never calls a model.
2. A payout requires the contract's own `finalized` flag, read at `LATEST_FINAL`.
   An accepted-but-appealable decision is refused.
3. Each claim can settle at most once: `not_settled → settling → settled`, checked and
   written before any transfer. Double-settlement is rejected and tested.
4. Success is tracked from the transfer's own outcome, never inferred by comparing a
   recipient's balance before and after.
5. Amounts are sized integers. Failure lands in `settlement_failed`, never a silent
   "settled".

---

## Data sources

Registry with URLs, fields, units, quirks and failure behaviour:
[`docs/sources.md`](docs/sources.md). All are open, key-free, and documented.

| Source | Variable | Unit | Grid |
|---|---|---|---|
| Open-Meteo Historical (ERA5) | `precipitation_sum`, `temperature_2m_max` | mm, °C | ~9 km |
| NASA POWER Daily v2 (MERRA-2) | `PRECTOTCORR`, `T2M_MAX` | mm/day, °C | coarser |

They legitimately disagree. That is the point.

**Historical simulation vs live.** Every policy and claim surface carries a badge.
Claim-2 through claim-5 are `historical_simulation`: the underlying values are fixed
records and re-evaluating cannot change them. The app never presents recorded data as
live, and the origin badge always states whether a screen is showing live chain reads
or a recorded snapshot.

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
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py   # 3 checks + validation
pytest tests/direct/ -q                                                # 112 passed
cd frontend && npx tsc -b --noEmit && npm run build                      # typecheck + build
```

The direct suite mocks web and LLM so it is fast and deterministic. It covers the
adversarial cases: threshold boundaries (`>` at exactly the threshold), all four
aggregation rules, conflicting sources, missing days and empty bodies with **no
interpolation**, location mismatch, out-of-period readings, unit mismatch and
unsupported units, source failures and malformed payloads, every valid and invalid
state transition, duplicate claims, dispute limits, settlement idempotency, and
prompt-injection fixtures.

---

## Limitations

Stated plainly:

1. **The StudioNet explorer is paused.** Transaction links cannot be verified, so the
   UI disables them with a reason instead of linking to a dead page.
2. **No claim is finalized**, so finality and settlement are implemented and unit
   tested but not demonstrated on chain.
3. **No integration tests.** `tests/integration/` does not exist. On-chain behaviour
   was verified by real writes against StudioNet rather than by an integration suite.
4. **StudioNet only.** No Bradbury/Asimov deployment, so no public-proof address.
5. **Payout amounts are zero**, so settlement cannot be walked end to end.
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
- Saved contract schema: [`docs/schema.json`](docs/schema.json)
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

No starter repository code was vendored. The contract, tests, fixtures and app were
written for this project against the GenLayer docs and the verified SDK.