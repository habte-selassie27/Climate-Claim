# Deployment — GenLayer Bradbury

**Status: live and verified.** Both contracts are deployed, both answered reads
after deployment, and this document is the record.

## The two contracts

| Contract | Address | Bytes | Methods |
|---|---|---|---|
| **ClimatePolicy** | `0xeebb68aEDB14A4184A0C36bAc5528D5f70B8a807` | 16,829 | 8 |
| **ClimateClaim** | `0x07C1c5740eD73576deF939bb938556761738dA03` | 18,600 | 16 |

- **Network**: GenLayer Bradbury, chain id **4221**
- **RPC**: `https://rpc-bradbury.genlayer.com`
- **Explorer**: <https://explorer-bradbury.genlayer.com>
- **Owner / deployer**: `0x04e0353B7218b66D6803725ce7342E6e1225DB1b`

| | Deploy transaction |
|---|---|
| ClimatePolicy | `0x8f704bc3bab2578a5c66981ba922dfb349a65f6817acac475af68d046889f658` |
| ClimateClaim | `0xa7deeaceb6ef12ca8b2a226c45b5502b062b344942859930300d52d5c2c7c631` |

Both reached consensus with **AGREE / FINISHED_WITH_RETURN**.

## What each contract does

**ClimatePolicy** owns the source registry, the policy lifecycle, and the
decision engine.

| Method | Kind | Purpose |
|---|---|---|
| `register_source` | write | Add a weather source to the registry (owner-only) |
| `create_policy` | write | Create a policy, freezing its sources (owner-only) |
| `set_beneficiary` | write | Change where a payout goes (owner-only) |
| `retire_policy` | write | Stop new claims on a policy (owner-only) |
| `get_policy` | view | One policy by id |
| `list_policies` | view | Every policy |
| `list_sources` | view | Every registered source |
| `compute_evaluation` | view | **Derive a decision** from a frozen policy + evidence rows |

**ClimateClaim** owns claims, disputes and settlement.

| Method | Kind | Purpose |
|---|---|---|
| `register_policy_snapshot` | write | Copy a policy across from ClimatePolicy (owner-only) |
| `start_claim` | write | Open a claim on a registered policy |
| `record_evaluation` | write | Store a decision against a claim (owner-only) |
| `open_dispute` | write | Challenge a decision |
| `resolve_dispute` | write | Record the outcome of a dispute (owner-only) |
| `finalize_decision` | write | Make the decision final |
| `fund` / `settle_claim` | write | Escrow and emit a payout |
| `confirm_settlement` / `fail_settlement` | write | Close out a payout attempt |
| `get_claim` | view | One claim with its evidence, disputes and settlement |
| `list_claims` | view | Every claim |
| `get_claim_count` | view | Claim total |
| `get_escrow_balance` | view | Escrowed funds |
| `get_refunds` / `get_in_flight` | view | Refunds and in-flight payouts |

Schemas read back from chain after deployment are saved at
[`schema/climate-policy.bradbury.txt`](schema/climate-policy.bradbury.txt) and
[`schema/climate-claim.bradbury.txt`](schema/climate-claim.bradbury.txt).

## Why two contracts

This is a deployment requirement, not a preference. Both GenLayer testnets reject
a deploy whose **source exceeds roughly 19 KB, comments included**. That was
measured, not assumed:

| Source size | Result |
|---|---|
| 18,600 B — ClimateClaim | **accepted** |
| 20,294 B | rejected, `gas limit too high` |
| 20,907 B — trivial getter, 90% comments | **rejected** |
| 26,103 B | rejected on Bradbury **and** Asimov |

A probe whose entire logic was one getter and whose body was 90% comments was
rejected, which rules out line count, AST size and logic complexity: the limit
counts source bytes. There is no override — `genlayer deploy` sends
`gas: estimatedGas` from an `eth_estimateGas` round trip, and `deployContract`
in genlayer-js accepts no `gas` parameter.

## Current on-chain contents

Verified with `scripts/verify-deployment.sh`:

- **2 sources** — `om_archive_precip` (Open-Meteo ERA5), `nasa_power_precip` (NASA POWER)
- **1 policy** — `policy-1`, Paris 48.85 N / 2.35 E, `gt` 1.00 mm, `max_single`, `unanimous`, `min_sources` 2, `historical_simulation`, 2024-06-01 to 2024-06-05
- **1 claim** — `claim-1`, on `policy-1`, `decided_confirmed`, `threshold_crossed`, observed 125 (= 1.25 mm), 2 evidence rows

The claim's decision was **derived** by `compute_evaluation` and then recorded
with `record_evaluation`. The decision was not chosen.

## Known limitations — verified, not assumed

**Nothing on chain fetches weather data.** No contract makes a web call or a
model call. Evidence rows are supplied by the caller, so **their provenance is
not provable on chain.** The UI does not claim otherwise anywhere.

**`compute_evaluation` is pure.** It has no storage reads and no clock, so
leader and validator compute identical results. This makes the decision
verifiable on chain rather than consensus-checked over nondeterministic
interpretation. That is a genuine improvement over storing whatever the owner
supplied, and it is not the same thing as validating nondeterministic output.

**`register_policy_snapshot` is owner-only.** A brand-new policy cannot back a
claim until the owner bridges it across. `/claims/new` says so rather than
letting it read as a bug.

**`record_evaluation` is owner-only** and stores the decision it is given. The
app derives that decision with `compute_evaluation` first and records that, but
the contract does not enforce the link.

## Historical deployments — superseded

These were real deployments. They are **not** what the app reads, and no file in
`src/` names them.

| Contract | Address | Superseded by |
|---|---|---|
| ClimatePolicy (previous) | `0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631` | `0xeebb68aE…B8a807` |
| ClimateClaim (previous) | `0xa2D82Db4ddC567199113962BFd477f069510331D` | `0x07C1c574…38dA03` |
| ClimateClaim monolith (StudioNet) | `0xE16032420e3155C0822e9150a98c6B1163869F0c` | superseded by the split |

The app used to fall back to a committed snapshot of the StudioNet monolith
holding 6 policies and 5 claims whenever the RPC failed. That fallback is gone
and the snapshot file is deleted: an empty state is correct where another
deployment's records are not.

## Reproducing a deploy

```bash
genlayer network set testnet-bradbury

# Lint first. Both contracts must pass before a deploy is attempted.
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Policy.py
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/Climate-Claim.py

genlayer deploy --contract contracts/Climate-Policy.py --args <owner-address>
genlayer deploy --contract contracts/Climate-Claim.py  --args <owner-address> <policy-address>

genlayer schema <address> > docs/schema/<name>.bradbury.txt
```

If a deploy fails, do not trust the CLI's success line — it prints
`✔ Contract deployed successfully` whenever consensus agreed, including when
execution then failed:

```bash
genlayer receipt <txHash>
genlayer trace <txHash>      # this is what shows the actual revert reason
```

## Verifying after a deploy

```bash
set -a && . ./.env && set +a
./scripts/verify-deployment.sh
```

It is read-only. It confirms both addresses hold bytecode on the configured
network, that every method the UI calls answers, and prints current contents.
It exits non-zero on any mismatch.

Two contracts with no bytecode is the failure this catches — a deploy that
reverted still produces an address.