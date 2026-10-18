# Contracts

Two files live here. Both are deployed. Nothing else in this repository is.

## What is deployed

| File | Lines | Methods | Address |
|---|---|---|---|
| `Climate-Policy.py` | 260 | 7 | `0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631` |
| `Climate-Claim-Small.py` | 427 | 16 | `0xa2D82Db4ddC567199113962BFd477f069510331D` |

Both on GenLayer Bradbury (chain 4221). Deploy hashes, consensus results and the
verification steps are in `docs/deployment-bradbury-2026-10-18.md`.

## Why there are two

Bradbury enforces a **size-dependent gas ceiling** on deploys. Measured, not
guessed:

| Source text | Result |
|---|---|
| 18,600 B — `Climate-Claim-Small.py` | deployed |
| 20,907 B — trivial getter, 90% comments | rejected — `gas limit too high` |
| 26,103 B — `reference/Climate-Evaluator.py` | rejected — `gas limit too high` |
| 63,506 B — comment-padded probe | rejected — `gas limit too high` |

The limit is on **source bytes, comments included**, and it sits between 18,600
and 20,907 bytes. It is not Bradbury-specific: the 26,103 B evaluator was
submitted to Asimov as well and rejected identically. There is no override —
`genlayer deploy` sends `gas: estimatedGas` from an `eth_estimateGas` round trip,
and `deployContract` in genlayer-js takes no `gas` parameter.

So a contract here has roughly a **19 KB source budget**. At the density of the
files in this directory that is about 430 lines.

A single contract could not be deployed anywhere public. Splitting it is what
made a public deployment possible, so the split is a deployment requirement
rather than a design preference. The same budget is why the evaluation engine
has no home on chain yet — see [`reference/`](../reference/README.md).

## The pre-split contract is not here

The 1406-line single-contract version, and the 170 tests that cover it, live in
[`archive/`](../archive/README.md). It is **not deployed** and it does not
contribute to this directory.

It is archived rather than deleted because it holds the only implementation of
the evaluation engine — weather retrieval, unit normalisation, aggregation,
threshold arithmetic, the model call and the equivalence rule. The deployed pair
does none of that: `record_evaluation` is owner-only and stores a decision the
caller supplies, verifying nothing.

`contracts/` is deliberately limited to what is actually on chain so that
"what is deployed" has exactly one answer.

## What the deployed pair does and does not do

`Climate-Claim-Small.py` is deliberately **much narrower** than the archived
version:

- **No on-chain evaluation.** `record_evaluation` is owner-only and takes the
  decision, reason, summary, observed value and evidence as arguments. The
  contract stores them and verifies none of them.
- **No per-check results.** Nothing produces threshold / period / location /
  agreement / completeness rows.
- **No weather access and no model call.** Neither contract in this directory
  performs a network request of any kind.
- **No cross-contract calls.** Storing a contract proxy in GenLayer state fails
  with `class is not marked for usage within storage ... @allow_storage`, so
  rather than depend on an unverified ABI, the two contracts are wired by an
  owner-mediated bridge: `register_policy_snapshot` copies a policy into the claim
  contract, and `start_claim` requires that snapshot to exist.

## Testing status

- `python3.12 -m pytest tests/direct -q` → 33 passed. These check that `.env`, the
  gltest yaml and the frontend config agree. **They do not test either contract.**
- `python3.12 -m pytest archive/tests -q` → 170 passed. These test
  `archive/climateclaim.py`, which is not deployed.
- **Neither deployed contract has a direct test suite.** Bridging that is the
  largest outstanding piece of work; it is recorded in the main README's
  limitations section rather than left implicit here.
