# Contracts

Two files live here. Both are deployed. Nothing else in this repository is.

## What is deployed

| File | Bytes | Methods | Address |
|---|---|---|---|
| `Climate-Policy.py` | 16,829 | 8 | `0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807` |
| `Climate-Claim.py` | 19,333 | 16 | `0xb80eC5aEa3A62a5F282DB19bA1ccE311b642bC51` |

Both on GenLayer Bradbury (chain 4221), deployed by
`0x04e0353B7218b66D6803725ce7342E6e1225DB1b`, both ACCEPTED / AGREE /
FINISHED_WITH_RETURN. Deploy transactions:
`0x8f704bc3bab2578a5c66981ba922dfb349a65f6817acac475af68d046889f658` (policy)
and `0xf3104e7bf5cea37819ea43c06100fabf12f1a98d0210f8028126410f1a1b2c1c` (claim).
Superseded addresses and their txs are in
`docs/deployment-bradbury-2026-10-18.md`.

## Why there are two

Bradbury enforces a **size-dependent gas ceiling** on deploys. Measured, not
guessed:

| Source text | Result |
|---|---|
| 18,600 B — `Climate-Claim.py` | deployed |
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

## What it DOES now do: derive the decision

`Climate-Policy.compute_evaluation(policy_json, evidence_json, days_expected)`
is the substantive addition. It derives the decision on chain:

- recomputes each evidence row's `crossed` flag from its raw scaled value and
  the frozen threshold, rather than trusting the row;
- applies the policy's agreement rule (`unanimous` / `majority` / `any`);
- reports `period_covered` and `data_completeness`, and refuses to decide when
  either fails;
- returns `confirmed`, `not_confirmed` or `inconclusive` with a reason code.

So a decision is a **derivation**, not an assertion. That was the gap the
previous pair left open.

It is a **pure function** — no storage reads, no clock — which is why it fits in
the space left by the size ceiling and why calling it needs no consensus round.
The tradeoff is stated plainly: this makes the decision verifiable, and it is
not the same as validating a non-deterministic result. The equivalence rule for
that lives in `docs/equivalence.md` and is not deployed.

`contracts/` is deliberately limited to what is actually on chain so that
"what is deployed" has exactly one answer.

## What the deployed pair does and does not do

`Climate-Claim.py` is deliberately **much narrower** than the archived
version. What the pair does NOT do:

- **No weather access and no model call.** Neither contract in this directory
  performs a network request of any kind, so evidence provenance is the
  caller's claim and is not provable on chain.
- **No consensus over non-deterministic interpretation.** See below.
- **No cross-contract calls.** Storing a contract proxy in GenLayer state fails
  with `class is not marked for usage within storage ... @allow_storage`, so
  rather than depend on an unverified ABI, the two contracts are wired by an
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
