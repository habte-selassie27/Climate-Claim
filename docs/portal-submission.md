# Builder portal submission — ClimateClaim (StudioNet, current)

Everything below was read back from StudioNet or from a command run on
2026-10-25. This file supersedes the Bradbury-era submission.

## Identity

- **Project:** ClimateClaim — evidence-based parametric weather claims
- **Repository:** <https://github.com/habte-selassie27/Climate-Claim> (branch `main`; wiring commit `0ee8561`)
- **Live app:** <https://climate-claim-fawn.vercel.app/>
- **Network:** GenLayer StudioNet (chain id 61999, gasless)
- **Explorer:** <https://explorer-studio.genlayer.com>
- **Owner / deployer:** `0x5B3661C576c7001e6d6279C67F3779705d334c89`

## Appeal: consensus evaluator is now the claim decision path

The rejection said the active app routed to **deterministic owner-controlled
contracts**, while the **source-fetching consensus evaluator was archived and
disconnected from the claim and settlement path**. That is fixed on chain:

1. **`ClimateClaim` was redeployed** at
   [`0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6`](https://explorer-studio.genlayer.com/address/0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6)
   with the evaluator address as a constructor argument. `get_evaluator()` returns
   `0xb0766279352537d71A7fE536E0c5b77ab1aa869e`.
2. **The owner-controlled decision methods are gone.** The deployed schema no
   longer contains `record_evaluation` or `resolve_dispute`. There is no method a
   caller can use to assert a decision, reason, value, or evidence.
3. **`sync_evaluation(claim_id)` is the only way a decision enters a claim.** It is
   permissionless. It reads the result stored by `ClimateEvaluator` for the claim's
   current dispute round, verifies the policy id, policy version and observation
   period, rebuilds the evidence rows from that result, calls
   `ClimatePolicy.compute_evaluation` to re-derive the outcome, and refuses to
   record anything if the decision or reason code disagree
   (`EXTERNAL: evaluation mismatch`).
4. **Disputes are re-evaluated, not overridden.** `open_dispute` increments the
   dispute round and leaves the claim `disputed`; a new
   `evaluate_for_claim` + `sync_evaluation` is required for that round. There is
   no owner-supplied resolution.
5. **Settlement cannot choose an outcome.** `settle_claim` consumes a decision
   that was already synced from consensus and finalized; it rejects a claim that
   is not `confirmed` + `finalized`, and is idempotent.

The evaluator is **not archived**. The deployed evaluator is
`contracts/Climate-Evaluator.py` at
[`0xb0766279352537d71A7fE536E0c5b77ab1aa869e`](https://explorer-studio.genlayer.com/address/0xb0766279352537d71A7fE536E0c5b77ab1aa869e);
the claim points at it, and the actual result used by the active claim is stored
there. The `archive/` directory is pre-split history and is not referenced by any
deployed contract.

## Deployed contracts

| Contract | Address | Bytes | Methods | Deploy tx |
|---|---|---|---|---|
| ClimatePolicy | [`0x4014b937482eedff10CE67Af8AF97De592BC15CA`](https://explorer-studio.genlayer.com/address/0x4014b937482eedff10CE67Af8AF97De592BC15CA) | 17,515 | 9 | [`0x2bbb7577…eb92a449`](https://explorer-studio.genlayer.com/tx/0x2bbb7577b8f37096f0882ef6494d2cdb78af45f2d406fc1c9412cfd7eb92a449) |
| ClimateClaim | [`0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6`](https://explorer-studio.genlayer.com/address/0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6) | 18,757 | 16 | [`0x8a9af0f8…4794d9fd`](https://explorer-studio.genlayer.com/tx/0x8a9af0f83ecde0dc739890ed61a2d3dabbd0def03a3cf1b3ca80c1af4794d9fd) |
| ClimateEvaluator | [`0xb0766279352537d71A7fE536E0c5b77ab1aa869e`](https://explorer-studio.genlayer.com/address/0xb0766279352537d71A7fE536E0c5b77ab1aa869e) | 19,149 | 2 | [`0x1ff43d06…0a157f8d`](https://explorer-studio.genlayer.com/tx/0x1ff43d06f829456df24b64ba533e0e6ea256b24dbc9c74ffd61f71a40a157f8d) |

All three deploy receipts are **FINALIZED / MAJORITY_AGREE**.

## Live end-to-end proof (not a scripted demo)

`policy-1` is Paris, France (`historical_simulation`), precipitation `gt`
1.00 mm, 2024-06-01 → 2024-06-05, two eligible sources (`om_archive_precip`,
`nasa_precip`), unanimous agreement. `claim-1` was opened for that period.

1. **Source-fetching consensus round** —
   [`evaluate_for_claim(0x2783…, "claim-1")`](https://explorer-studio.genlayer.com/tx/0xc3864051040577a21e411a18dc75a20f81cf8308f1f07173d5f5710482ba0675)
   tx `0xc3864051040577a21e411a18dc75a20f81cf8308f1f07173d5f5710482ba0675`,
   **FINALIZED / MAJORITY_AGREE**. Validators fetched both sources inside the
   round. Stored result (`get_result("claim-1", 0)`):

   ```text
   decision: confirmed          reason_code: threshold_crossed
   observed_value_scaled: 269   (2.69 mm; threshold 100 = 1.00 mm)
   checks: threshold_crossed=pass, period_covered=pass, location_match=pass,
           source_agreement=pass, data_completeness=pass
   sources: om_archive_precip  value_scaled=160  crossed=true  days_covered=5
            nasa_precip        value_scaled=379  crossed=true  days_covered=5
   policy_id=policy-1  policy_version=1  round=0  period=2024-06-01..2024-06-05
   ```

2. **Claim sync** —
   [`sync_evaluation("claim-1")`](https://explorer-studio.genlayer.com/tx/0xac4629ab10ba9baa4fd8e01d0fa07b1f39e0976db440f9509b8998f4e920ccf8)
   tx `0xac4629ab10ba9baa4fd8e01d0fa07b1f39e0976db440f9509b8998f4e920ccf8`,
   **FINALIZED / MAJORITY_AGREE**. `get_claim("claim-1")` now returns:

   ```text
   state: decided_confirmed     decision: confirmed
   reason: threshold_crossed    observed_scaled: 269
   evaluation_round: 1          finalized: false
   settlement_state: not_settled
   evidence: the two source rows above
   ```

3. **Claim creation** — `start_claim` tx
   [`0x1a5e007f…aa7dc592`](https://explorer-studio.genlayer.com/tx/0x1a5e007ff08ab7beb0ab14dd48458e3401a202e5e009d92b08679391aa7dc592),
   **FINALIZED / MAJORITY_AGREE**.

The live app points at these exact addresses. Its claim-detail action performs
the two writes in order (`evaluate_for_claim`, then `sync_evaluation`); see
`frontend/src/services/evaluationService.ts` and
`frontend/src/pages/ClaimDetail.tsx`. The production JS bundle was checked on
2026-10-25 and contains the three addresses above.

## Reviewer verification (copy-paste)

```bash
genlayer network set studionet

# 1. The claim points at the deployed evaluator.
genlayer call 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_evaluator
# -> 0xb0766279352537d71A7fE536E0c5b77ab1aa869e

# 2. The evaluator holds the consensus result used by the claim.
genlayer call 0xb0766279352537d71A7fE536E0c5b77ab1aa869e get_result --args "claim-1" 0

# 3. The claim recorded that result.
genlayer call 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6 get_claim --args "claim-1"

# 4. The owner-controlled decision methods are absent from the deployed schema.
genlayer schema 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6
# -> includes sync_evaluation and get_evaluator;
#    no record_evaluation, no resolve_dispute

# 5. The deployed code is the repository source.
genlayer code 0x2783Afd5C0eCDd99Dbba8d178b8Ab1741d3433b6
genlayer code 0xb0766279352537d71A7fE536E0c5b77ab1aa869e

# 6. Receipts (all FINALIZED / MAJORITY_AGREE).
genlayer receipt 0xc3864051040577a21e411a18dc75a20f81cf8308f1f07173d5f5710482ba0675
genlayer receipt 0xac4629ab10ba9baa4fd8e01d0fa07b1f39e0976db440f9509b8998f4e920ccf8
```

## Why GenLayer is required

Weather records are fetched from live web APIs, and two authoritative sources can
legitimately disagree for the same place and period. Validators must agree on the
*meaning* of those records against the policy (source identity, station distance,
period coverage, unit normalisation, agreement rule), not on byte-identical
payloads. The evaluator does that inside `gl.vm.run_nondet`: leader and validators
fetch independently, normalise deterministically, and compare the decision, reason,
required checks, per-source crossing flags and scaled values within tolerance. A
`confirmed` result whose arithmetic does not support it is rejected. The claim
contract then recomputes the decision from the evidence with
`ClimatePolicy.compute_evaluation` before recording it.

## Honest limitations

- StudioNet is a test network; no real funds are at stake.
- `finalize_decision` and `settle_claim` are owner-triggered. They cannot select or
  change a decision; they only advance a decision already produced by consensus.
- The current demo claim uses `historical_simulation`. The same path handles live
  sources, but the on-chain proof above is a historical period.
- The full LLM-assisted policy-wording design in `archive/` is not deployed; the
  deployed evaluator is deterministic over fetched structured weather data.
