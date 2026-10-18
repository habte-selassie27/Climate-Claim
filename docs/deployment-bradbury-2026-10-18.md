# Bradbury deployment record — 2026-10-18

Both contracts below are **live on GenLayer Bradbury (chain 4221)**. Every value
here was read back from the chain or the explorer API; nothing is estimated.

## ClimatePolicy

```
NETWORK:            GenLayer Bradbury Testnet (chain 4221)
RPC:                https://rpc-bradbury.genlayer.com
CONTRACT FILE:      contracts/Climate-Policy.py  (260 lines)
CONTRACT NAME:      ClimatePolicy
CONTRACT ADDRESS:   0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631
DEPLOY TX HASH:     0x4bd15661906406d0d5b63dc51cef8ebb4c122e0d7788e2d0f0d9111f9c250516
STATUS:             accepted · FINISHED_WITH_RETURN
CONSENSUS:          5/5 AGREE
DEPLOYER:           0x04e0353B7218b66D6803725ce7342E6e1225DB1b
EXPLORER:           https://explorer-bradbury.genlayer.com/address/0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631
STUDIO IMPORT:      https://studio.genlayer.com/?import-contract=0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631
SCHEMA SAVED AT:    docs/schema/climate-policy.bradbury.txt
METHODS:            7 (3 view, 4 write)
CONSTRUCTOR ARGS:   owner = 0x04e0353B7218b66D6803725ce7342E6e1225DB1b
```

First reads (real output, not placeholders):

- `list_sources` → `[]`
- `list_policies` → `[]`

Both are empty because the registry is owner-managed and nothing has been
registered yet.

## ClimateClaim

```
NETWORK:            GenLayer Bradbury Testnet (chain 4221)
RPC:                https://rpc-bradbury.genlayer.com
CONTRACT FILE:      contracts/Climate-Claim-Small.py  (427 lines)
CONTRACT NAME:      ClimateClaim
CONTRACT ADDRESS:   0xa2D82Db4ddC567199113962BFd477f069510331D
DEPLOY TX HASH:     0x6130f4f929c1612a52b49c2e8ce7c2f02260c41afa10fb965ddfa28c667309ff
STATUS:             accepted · FINISHED_WITH_RETURN
CONSENSUS:          5/5 AGREE
DEPLOYER:           0x04e0353B7218b66D6803725ce7342E6e1225DB1b
EXPLORER:           https://explorer-bradbury.genlayer.com/address/0xa2D82Db4ddC567199113962BFd477f069510331D
STUDIO IMPORT:      https://studio.genlayer.com/?import-contract=0xa2D82Db4ddC567199113962BFd477f069510331D
SCHEMA SAVED AT:    docs/schema/climate-claim.bradbury.txt
METHODS:            16 (6 view, 10 write)
CONSTRUCTOR ARGS:   owner = 0x04e0353B7218b66D6803725ce7342E6e1225DB1b
                    policy_contract = 0x7851eea34196DA4B796b665f2DBb2D3a3E3bc631
```

First reads (real output):

- `get_claim_count` → `0`
- `get_escrow_balance` → `0`

## Why Bradbury and not StudioNet

StudioNet was the intended target but could not be used:

- Its `standard` bucket reported `500/500` used on both the hour and the day
  windows, with `retry_after_seconds` bouncing between ~35 and ~11000 across
  consecutive probes. The bucket never actually drained, so the deploy could not
  be scheduled.
- `eth_chainId` answered fine throughout, so only the heavy methods are metered.

Bradbury had previously rejected large contracts with `gas limit too high`. Two
things resolved that:

- ClimatePolicy (260 lines) and ClimateClaim (427 lines) are both far below the
  size of the earlier monolith. A 793-line contract was still rejected, so the
  ceiling sits between roughly 793 and 427 lines.
- A 2-method probe had already proven the full deploy/read/write lifecycle works
  on Bradbury, which located the problem in contract size rather than the network
  being unusable.

## Verification performed

- `eth_getCode` on `https://rpc-bradbury.genlayer.com` returns real bytecode for
  both addresses.
- `https://studio.genlayer.com/api` returns `Contract ... not found` for both,
  confirming they are **not** on StudioNet and are not being confused with the
  older StudioNet deployment at `0x6E4BD06bD969E745546A7957d818eDaD47882ea8`.
- `genlayer schema` succeeded for both, so the genlayer-js read path (the same
  one the frontend uses) resolves them.
- Explorer pages render for both addresses.

## Known state, stated plainly

- `gen_getContractSchema` sent by hand over raw RPC returns
  `VMError: invalid_contract absent_runner_comment`. The CLI's own schema and
  call commands work, so this looks like a parameter-shape quirk of that raw
  method rather than a broken deployment. Not yet fully explained.
- The earlier StudioNet deployment of the 32-method monolith still exists at
  `0x6E4BD06bD969E745546A7957d818eDaD47882ea8`. The frontend currently points
  there. These Bradbury contracts are a separate, newer deployment.
- `Climate-Claim-Small.py` deliberately contains no LLM or web access. Evaluation
  reaches it through the owner-only `record_evaluation` method, and the policy
  bridge is the owner-mediated `register_policy_snapshot`, per the file's own
  docstring. The decision is therefore not computed on chain by these two
  contracts, and the frontend's method names do not match this interface yet.
