# archive/

**Nothing in this directory is deployed. Nothing here runs by default.**

It holds the pre-split ClimateClaim contract and the test suite that covers it.
It is kept because deleting the contract orphaned those tests — all 170 failed
with `FileNotFoundError` — and because the code here is the project's evaluation
engine, which is the part that makes GenLayer necessary.

## What is here

| Path | What it is |
|---|---|
| `climateclaim.py` | 1406 lines, 32 methods. The single-contract design. |
| `tests/` | 170 direct tests covering it, plus the fixtures they need. |

## What is deployed instead

`contracts/Climate-Policy.py` (260 lines, 7 methods) and
`contracts/Climate-Claim-Small.py` (427 lines, 16 methods), both on GenLayer
Bradbury. Details and addresses: [`contracts/README.md`](../contracts/README.md)
and [`docs/deployment-bradbury-2026-10-18.md`](../docs/deployment-bradbury-2026-10-18.md).

The split was forced by Bradbury's size-dependent gas ceiling: a 793-line
contract is rejected with `gas limit too high` while 260-line and 427-line
contracts deploy. `climateclaim.py` at 1406 lines cannot be deployed there.

## Why it is not just deleted

`climateclaim.py` contains the only implementation of the evaluation engine:

- retrieval from Open-Meteo archive and NASA POWER, capped and deterministic
- unit normalisation and timezone handling
- aggregation: `max_single`, `cumulative`, `consecutive_days`
- threshold comparison in integer arithmetic, not by the model
- a model call for the parts that genuinely need interpretation
- the equivalence rule deciding whether a leader and a validator agree on
  *meaning* rather than on bytes
- the failure taxonomy: source conflict, missing observations, location
  mismatch, unreachable sources

The deployed pair does none of this. It stores a decision the owner supplies.
Deleting the engine would leave the project unable to state how its central claim
is actually computed, so it is archived rather than removed.

## Running the archived tests

```bash
python3.12 -m pytest archive/tests -q     # 170 passed
```

They are outside `tests/` so the default gate does not collect them:

```bash
python3.12 -m pytest tests/direct -q      # 33 passed (env consistency only)
```

Both suites pass. Run them together with `python3.12 -m pytest archive/tests tests/direct -q`.

## The honest status

- The 170 archived tests **do not cover anything deployed**.
- The two deployed contracts have **no direct test suite**.
- Bridging that gap — either by testing the deployed pair, or by making the
  evaluation engine deployable so its tests cover something real — is the largest
  outstanding piece of work in this repository.
