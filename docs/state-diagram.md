# Claim state machine

> **Historical design; the deployed path is different.** This page describes the
> pre-split single contract in `archive/climateclaim.py` (kept as design
> history). The deployed StudioNet path uses three contracts:
>
> 1. `ClimateEvaluator.evaluate_for_claim(claim_address, claim_id)` fetches the
>    eligible sources inside a leader/validator round and stores the result.
> 2. `ClimateClaim.sync_evaluation(claim_id)` re-derives the decision from that
>    result with `ClimatePolicy.compute_evaluation` and records it.
> 3. `open_dispute` increments the round; resolving it requires a fresh
>    `evaluate_for_claim` + `sync_evaluation`. There is no `resolve_dispute` and
>    no `request_evaluation` in the deployed claim schema.
>
> Current proof and commands: [`portal-submission.md`](portal-submission.md).
> The rest of this page documents the archived state machine and its tests.

Every transition is enumerated here, enforced in `archive/climateclaim.py`,
and covered by direct tests (valid **and** invalid).

```
                     start_claim(policy, period)
        (none) ─────────────────────────────────▶ created
                                                    │
                                                    │ request_evaluation(claim)
                                                    ▼
                                          pending_evaluation  (transient; set and
                                                    │          replaced inside the same tx)
                 ┌──────────────────────────────────┼────────────────────────────┐
                 │                                  │                            │
        evidence_collected                  decided_confirmed            decided_not_confirmed
        (EXTERNAL failure:                  │        │                            │
         retryable)                         │        │                            │
                 │                          │        │                            │
                 │                          │        └────────────┬───────────────┘
                 │                          │        inconclusive │
                 │                          │             │       │
                 │  request_evaluation ◀────┼─────────────┘       │
                 │  (retry, allowed only    │  open_dispute(claim, grounds)
                 │   from inconclusive or   │  dispute_rounds += 1   │
                 │   evidence_collected)    │                     ▼
                 │                          │                 disputed
                 │                          │                     │
                 │                          │        resolve_dispute(claim)
                 │                          │                     │
                 │                          │                     ▼
                 │                          │        pending_evaluation → decided_* / inconclusive
                 │                          │        (eval_round += 1 only when an outcome is
                 │                          │         actually recorded; a source outage keeps
                 │                          │         the claim `disputed` with its grounds)
                 │                          │
                 │                    finalize_decision(claim)   [finality gate:
                 │                          │         LATEST_FINAL must match decision AND round]
                 │                          ▼
                 │                  decided_confirmed + finalized
                 │                          │
                 │                 settle_claim(claim)  [owner only, idempotent]
                 │                          │  emits the payout; NOT delivery
                 │                          ▼
                 │                   payout_emitted  ──confirm_settlement──▶ settled
                 │                          │        └──fail_settlement────▶ settlement_failed
                 │                          └──__on_errored_message__─────▶ settlement_failed
                 │                                   (refund; retryable via settle_claim)
                 └── (retry) ──▶ request_evaluation
```

## Claim states

| State | Meaning |
|---|---|
| `created` | Claim exists; evidence not yet requested. |
| `pending_evaluation` | Transient state written at the start of an evaluation tx; always replaced before the tx commits. |
| `evidence_collected` | Evidence was fetched but evaluation could not complete (all sources unreachable). Retryable. |
| `decided_confirmed` | Evidence met the policy condition under the stated rules. |
| `decided_not_confirmed` | Evidence did not meet the condition. |
| `inconclusive` | Evidence was incomplete or sources conflicted. A legitimate result, not an error. |
| `disputed` | A dispute is open (opened, or its re-evaluation could not fetch evidence) and can be retried. |
| `settled` | A payout was emitted **and its delivery was verified**. |

## Settlement states (`Claim.settlement_state`)

| State | Meaning |
|---|---|
| `not_settled` | No payout message has been emitted. |
| `payout_emitted` | The payout message was emitted. On GenLayer the value leaves the contract at emission but reaches the recipient only when the message's child transaction activates, so this is deliberately **not** reported as paid. |
| `settled` | `confirm_settlement` recorded that the child transaction executed. Never inferred from a balance. |
| `settlement_failed` | The emit failed, the operator recorded a failure, or `__on_errored_message__` refunded the value. Retryable through `settle_claim`. |

## Transitions (enforced)

| From | Method | To | Guard |
|---|---|---|---|
| — | `start_claim` | `created` | policy active; period within the policy window; not a duplicate of (policy, period); `claim_count` below the 1,000,000 cap. The window is stored **on the claim** and is what evaluation reads |
| `created` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | claim belongs to caller or caller is owner; no settlement has started |
| `inconclusive` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | retry allowed |
| `evidence_collected` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | retry after `EXTERNAL` |
| `decided_confirmed` / `decided_not_confirmed` / `inconclusive` | `open_dispute` | `disputed` | claimant or owner; `dispute_rounds < MAX_DISPUTE_ROUNDS`; no settlement started |
| `disputed` | `resolve_dispute` | `decided_*` / `inconclusive`, or back to `disputed` on a source outage | claimant or owner; `eval_round` advances only when an outcome is recorded |
| `decided_*` / `inconclusive` | `finalize_decision` | same state, `finalized=true` | owner only; the `LATEST_FINAL` snapshot must match the decision, the reason code **and** `eval_round` |
| `decided_confirmed` + `finalized` | `settle_claim` | `payout_emitted` | owner only; `settlement_state` is `not_settled` or `settlement_failed`; amount > 0; balance sufficient |
| `payout_emitted` | `confirm_settlement` | `settled` | owner only; delivery verified out of band |
| `payout_emitted` | `fail_settlement` | `settlement_failed` | owner only; a bounded reason string |
| `payout_emitted` | `__on_errored_message__` | `settlement_failed` (only if exactly one payout is in flight) | refund record always written |

## Rejected (tested) transitions

- `start_claim` duplicate of the same (policy, period) → `EXPECTED: duplicate claim`
- `request_evaluation` from a `decided_*` state without a dispute → `EXPECTED: claim already decided`
- `open_dispute` from `created` / `evidence_collected` / `disputed` → `EXPECTED: cannot dispute`
- `open_dispute` when dispute rounds are exhausted → `EXPECTED: dispute limit reached`
- `open_dispute` / `request_evaluation` once a settlement has started → `EXPECTED: settlement already started`
- `resolve_dispute` from a non-`disputed` state → `EXPECTED: not disputed`
- `finalize_decision` from a non-`decided` state → `EXPECTED: not decided`
- `finalize_decision` when the finalized snapshot does not match → `EXPECTED: decision not final`
- `finalize_decision` when the finality read is unavailable → `EXTERNAL: finality check unavailable`
- `settle_claim` before `finalized` → `EXPECTED: decision not final`
- `settle_claim` when `decision != confirmed` → `EXPECTED: claim not confirmed`
- `settle_claim` while a payout is in flight → `EXPECTED: payout already in flight`
- `settle_claim` after confirmation → `EXPECTED: already settled`
- `settle_claim` by a non-owner → `EXPECTED: not owner`
- `confirm_settlement` / `fail_settlement` with nothing in flight → `EXPECTED: no payout in flight`

## Repeated claim attempts

- A second `start_claim` for the **same `(policy_id, period_start, period_end)`**
  is rejected deterministically; the existing id is exposed via the `find_claim`
  view (`claim_index[policy_id|start|end]`).
- Retrying an **inconclusive** claim is done with `request_evaluation`, not a new
  claim.
- Retrying after an **`EXTERNAL`** failure is likewise `request_evaluation` from
  `evidence_collected`.
- A **dispute** round is counted when it is *opened*, so a re-evaluation that
  cannot reach any source cannot be used to open unlimited rounds; the claim
  stays `disputed` (grounds preserved) and `resolve_dispute` can be retried.
