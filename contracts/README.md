# Contracts

Three files live here, and they are not interchangeable. This note exists because
"which contract is deployed" is the first question a reader will have.

## What is actually deployed

| File | Lines | Methods | Status |
|---|---|---|---|
| `Climate-Policy.py` | 260 | 7 | **DEPLOYED** — Bradbury |
| `Climate-Claim-Small.py` | 427 | 16 | **DEPLOYED** — Bradbury |
| `climateclaim.py` | 1406 | 32 | **NOT deployed** — pre-split source, reference only |

`Climate-Policy.py` and `Climate-Claim-Small.py` are the live pair:

```
ClimatePolicy  0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631
ClimateClaim   0xa2D82Db4ddC567199113962BFd477f069510331D
```

Both on GenLayer Bradbury (chain 4221). Deploy hashes, consensus results and the
verification steps are in `docs/deployment-bradbury-2026-10-18.md`.

## Why the split

Bradbury enforces a **size-dependent gas ceiling** on deploys. Measured, not
guessed:

| Contract size | Result on Bradbury |
|---|---|
| 793 lines | rejected — `gas limit too high` |
| 427 lines | deployed |
| 260 lines | deployed |
| 1406 lines | rejected — `gas limit too high` |

A single contract could not be deployed anywhere public. Splitting it is what
made a public deployment possible, so the split is a deployment requirement
rather than a design preference.

## Why `climateclaim.py` is still here

It is the pre-split source and it is **not deployed**. It stays because the
direct test suite exercises it:

```
python3.12 -m pytest tests/direct -q     # 203 tests, covers climateclaim.py
```

Deleting it orphaned all 203 tests — every one failed with
`FileNotFoundError: contracts/climateclaim.py`. The file is retained so that the
audited behaviour keeps its tests and its evidence.

That said, be clear about what this means: **the 203 direct tests do not cover the
two deployed contracts.** They cover a contract that is not deployed. The
deployed pair has no direct test suite yet. That is a real gap, not a footnote.

## What the deployed pair does and does not do

`Climate-Claim-Small.py` is deliberately **much narrower** than `climateclaim.py`.
It does not fetch weather data, does not call a model, and does not evaluate
anything. Its docstring says so, and this is the consequence for anyone reading
the old one first:

- **No on-chain evaluation.** `record_evaluation` is owner-only and takes the
  decision, reason, summary, observed value and evidence as arguments. The
  contract stores them and verifies none of them. The predecessor fetched
  Open-Meteo / NASA POWER, asked a model for a structured judgement, and checked
  the equivalence of two independently produced results under consensus.
- **No per-check results.** Nothing produces threshold / period / location /
  agreement / completeness rows.
- **No cross-contract calls.** Storing a contract proxy in GenLayer state fails
  with `class is not marked for usage within storage ... @allow_storage`, so
  rather than depend on an unverified ABI, the two contracts are wired by an
  owner-mediated bridge: `register_policy_snapshot` copies a policy into the claim
  contract, and `start_claim` requires that snapshot to exist.

The alphabetically-first file is not the entry point. Read
`Climate-Claim-Small.py` to understand the deployed claim lifecycle, and read
`climateclaim.py` only as the design the project came from.
