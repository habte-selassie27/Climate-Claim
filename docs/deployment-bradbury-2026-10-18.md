# Deployment — GenLayer Bradbury

**Status: live and verified.** Both contracts are deployed, both answered reads
after deployment, and this document is the record.

## The two contracts

| Contract | Address | Bytes | Methods |
|---|---|---|---|
| **ClimatePolicy** | `0x02b75bBd0E0398D19e0750d6adc513605AEF6DFC` | 17,643 | 9 |
| **ClimateClaim** | `0x0b7Cfa4012fADd9f570951bCE059bB4e2497D311` | 19,410 | 16 |

- **Network**: GenLayer Bradbury, chain id **4221**
- **RPC**: `https://rpc-bradbury.genlayer.com`
- **Explorer**: <https://explorer-bradbury.genlayer.com>
- **Owner / deployer**: `0x04e0353B7218b66D6803725ce7342E6e1225DB1b`

| | Deploy transaction |
|---|---|
| ClimatePolicy | `0x414c5dbb2e4327aafc7c2a687604a78e867894a38b63fc5fc77a211448022c52` |
| ClimateClaim | `0x591eef3c1e3cb4ec221f2a20e154d67b4907e7bf84a4003820f6f0d6706953b3` |

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
| `set_policy_status` | write | Set a policy's status to `active` or `retired` (owner-only) |
| `get_policy` | view | One policy by id |
| `list_policies` | view | Every policy |
| `list_sources` | view | Every registered source |
| `compute_evaluation` | view | **Derive a decision** from a frozen policy + evidence rows |

**ClimateClaim** owns claims, disputes and settlement.

| Method | Kind | Purpose |
|---|---|---|
| `register_policy_snapshot` | write | Cache a policy copy (permissionless; `start_claim` ignores it) |
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
| 17,643 B — current ClimatePolicy | **accepted** |
| 18,600 B | **accepted** |
| 19,333 B | **accepted** |
| 19,410 B — current ClimateClaim | **accepted** |
| 20,294 B | rejected, `gas limit too high` |
| 20,907 B — trivial getter, 90% comments | **rejected** |
| 26,103 B | rejected on Bradbury **and** Asimov |

The accepted ceiling therefore sits between 19,333 B and 20,294 B.

A probe whose entire logic was one getter and whose body was 90% comments was
rejected, which rules out line count, AST size and logic complexity: the limit
counts source bytes. There is no override — `genlayer deploy` sends
`gas: estimatedGas` from an `eth_estimateGas` round trip, and `deployContract`
in genlayer-js accepts no `gas` parameter.

## Current on-chain contents

Verified with `scripts/verify-deployment.sh`:

- **3 sources** — `om_archive_precip` (Open-Meteo ERA5), `nasa_power_precip`
  (NASA POWER) and `om_forecast_precip` (Open-Meteo Forecast, registered for
  `live` policies)
- **6 policies, all active** — `policy-1`..`policy-5`, each Paris / Oslo / Paris /
  Reykjavik / Nairobi with `historical_simulation` and a 5-day 2024 window, plus
  `policy-6`: a **live** policy on Paris with the Open-Meteo Forecast source,
  2026-10-18 to 2026-10-28, `gt` 0.50 mm.
  The predecessor `policy-6` on the superseded deployment was **retired by
  mistake** (tx `0xf91700ebe46f55f79ca672d3a9f8eb3069c3cae88627aee0b6bbb69a4fd58d63`
  created it; a later `retire_policy` call on it could not be undone, because the
  contract had no way back). That mistake is why this deployment exists — see
  *Why this deployment exists* below.
- **5 claims** — one per policy, each with a decision **derived** by
  `compute_evaluation` and then recorded with `record_evaluation`:

  | Claim | Policy | Decision | Reason | Observed |
  |---|---|---|---|---|
  | `claim-1` | `policy-1` | `confirmed` | `threshold_crossed` | 127 (1.27 mm) |
  | `claim-2` | `policy-2` | `not_confirmed` | `threshold_not_crossed` | 85 (0.85 mm) |
  | `claim-3` | `policy-3` | `inconclusive` | `source_conflict` | 107 (1.07 mm) |
  | `claim-4` | `policy-4` | `inconclusive` | `missing_observations` | 0 |
  | `claim-5` | `policy-5` | `confirmed` | `threshold_crossed` | 275 (2.75 mm) |

  The spread is deliberate: `claim-3` is two sources disagreeing under a
  `majority` rule that has no tie-break, and `claim-4` is a source that never
  returned. Neither is an error state; both are first-class outcomes.

The claim's decision was **derived** by `compute_evaluation` and then recorded
with `record_evaluation`. The decision was not chosen.

## Why this deployment exists

Two defects in the previous deployment (ClimatePolicy `0xeebb68aE…B8a807`,
ClimateClaim `0xb80eC5aE…42bC51`) could only be fixed by redeploying, because
both were baked into artifacts rather than configuration:

1. **A retired policy could not be brought back.** A live policy was retired by
   mistake on 2026-10-18 while claims were being seeded. `retire_policy` was the
   only status write, so the call was irreversible and the only remedy was a
   redeploy. This deployment adds **`set_policy_status`**, which sets a policy to
   `active` or `retired` — owner-only, and it bumps the version like every other
   policy mutation. Retiring is one call; it should not cost a deployment to
   undo.
2. **The deployed module docstring was stale.** `Climate-Claim.py`'s docstring
   still described an owner-mediated snapshot bridge that no longer existed.
   GenVM deploys the Python source itself, so that text was part of the artifact
   at `0xb80e…42bC51`, and editing the repository would have made it disagree
   with `genlayer code` on chain. The docstring deployed here describes the
   cross-contract read as it actually works.

The superseded deployment's state was backed up to
`artifacts/bradbury-backup-pre-redeploy.json` before it was replaced, then
replayed onto these contracts with `frontend/scripts/reseed-from-backup.mjs`.
(`artifacts/` is gitignored in this repository, so the backup is local; the
script that produced it, `frontend/scripts/dump-state.mjs`, is committed and can
re-read any deployment in the same shape.)
Every source, policy, claim and evidence row came from that backup, and no
decision was copied: each one was re-derived with `compute_evaluation` and
checked against what the previous deployment had decided.

## Known limitations — verified, not assumed

**Nothing on chain fetches weather data.** No contract makes a web call or a
model call. Evidence rows are supplied by the caller, so **their provenance is
not provable on chain.** The UI does not claim otherwise anywhere.

**`compute_evaluation` is pure.** It has no storage reads and no clock, so
leader and validator compute identical results. This makes the decision
verifiable on chain rather than consensus-checked over nondeterministic
interpretation. That is a genuine improvement over storing whatever the owner
supplied, and it is not the same thing as validating nondeterministic output.

**`start_claim` reads the authoritative policy cross-contract.** `register_policy_snapshot`
is no longer a bridge that must be run first: `start_claim` calls
`get_policy` on ClimatePolicy through `gl.get_contract_at`, so a claim is
opened against the terms ClimatePolicy actually holds, and no caller-supplied
copy can be substituted. `register_policy_snapshot` is still exposed but is now
only a cache, and it is permissionless because `start_claim` ignores it.

Two caveats, both measured rather than assumed. `gl.get_contract_at` requires an
`Address`; handed a plain string it raises `TypeError`, which surfaced as
`EXTERNAL: policy contract unreachable`. And a view read inside a write is not
atomic in practice — `start_claim` succeeded only on a retry several times while
this deployment was being seeded, so callers must retry rather than assume one
submission is enough.

**`aggregation` is recorded but not applied.** `_evaluate` in Climate-Policy
compares each evidence row's `value_scaled` directly against the threshold; it
never reads the policy's `aggregation` field. The evidence value is therefore
understood as *the already-aggregated value for the period*, which is what the
caller supplies. A policy that says `cumulative` does not cause the contract to
sum anything.

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
| ClimateClaim (bridge-era) | `0x07C1c5740eD73576deF939bb938556761738dA03` | `0xb80eC5aE…42bC51` |
| ClimateClaim monolith (StudioNet) | `0xE16032420e3155C0822e9150a98c6B1163869F0c` | superseded by the split |

The bridge-era ClimateClaim is superseded because it required the owner to run
`register_policy_snapshot` by hand before any claim could exist. Two probe
contracts (`0xEa69cfD362Acd3f72d9D705007250DCecc0C01D7` and
`0xC96F2BD97d4e4aCBe4a59C13acDc5A07A2c0cA9c`) were also deployed while
measuring whether cross-contract reads work; they are throwaway probes holding
no state anyone depends on.

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