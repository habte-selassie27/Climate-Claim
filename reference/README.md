# Reference implementations

Code here is **lint-clean and deliberately not deployed.** It is kept because it
is the design work for the part of ClimateClaim that GenLayer's testnets cannot
currently host, and because deleting it would mean re-deriving it later.

If a network with enough deploy headroom becomes available, this is the file to
deploy. Nothing else in the repository depends on it.

## What is here

| File | Lines | Bytes | Methods | Status |
|---|---|---|---|---|
| `Climate-Evaluator.py` | 595 | 26,103 | 1 write, 3 views | lint clean, not deployed |

It performs the consensus evaluation: fetch the policy's frozen sources,
normalise units, aggregate, compare against the threshold in integer arithmetic,
and produce a decision that a validator independently reproduces under the
equivalence rule documented in its own header.

## Why it is not deployed

Both GenLayer testnets reject a deploy whose **source text exceeds ~19 KB**,
comments included. This was measured, not inferred — a probe whose logic was a
single getter and whose body was 90% comments was still rejected:

| Source size | Outcome |
|---|---|
| 18,600 B — `Climate-Claim-Small.py`, deployed | accepted |
| 20,907 B — trivial logic, comment-padded probe | **rejected** — `gas limit too high` |
| 26,103 B — this evaluator | **rejected** — `gas limit too high` |
| 30,314 B — earlier revision of this evaluator | **rejected** — `gas limit too high` |
| 63,506 B — comment-padded probe | **rejected** — `gas limit too high` |

The same ceiling applies on Bradbury and on Asimov: this evaluator was submitted
to both and rejected identically. So the limit is a property of the GenLayer
testnet stack, not of one network.

There is no override. `genlayer deploy` sets `gas: estimatedGas` from
`client.estimateTransactionGas`, which is an `eth_estimateGas` round trip; the
node's own computed requirement is what gets rejected. `deployContract` in
genlayer-js accepts no `gas` parameter, and passing one is silently ignored.

Because comment lines cost the same as code lines, the limit cannot be worked
around by moving documentation elsewhere.

## How far it was compressed before giving up

The evaluator started at 48,874 B with the full engine. Reaching 26,103 B
already required removing:

- the model call entirely (summary text and the location second-opinion)
- the NASA POWER parser, leaving one source parser
- the temperature metric
- the `consecutive_days` aggregation
- the owner, the ownership checks and the owner-registered policy snapshot
- stored per-evaluation criteria versions (now a constant)
- per-check human-readable detail strings
- most docstrings, and the exhaustive policy validation

What is left is only what makes it correct. Getting to 18,600 B would mean
deleting `_equivalent`, `_valid`, `_once` or `_fetch` — that is, deleting the
consensus logic that is the entire reason the contract exists. So the
compression was stopped deliberately rather than continued.

**The practical consequence:** the evaluator needs roughly **30 KB** of headroom,
which StudioNet has (it accepted the 1,406-line, 63 KB pre-split contract).
StudioNet was unreachable throughout this work because of its 500-requests-per-
hour limit, not because of size. Once that limit is not exhausted, this contract
can be deployed there unchanged.
