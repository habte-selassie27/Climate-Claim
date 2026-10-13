# Claim state machine

Every transition is enumerated here, enforced in `contracts/climateclaim.py`,
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
        evidence_ collected                 decided_confirmed              decided_not_confirmed
        (EXTERNAL failure:                  │        │                            │
         retryable)                         │        │                            │
                 │                          │        │                            │
                 │                          │        │                            │
                 │                          │        └────────────┬───────────────┘
                 │                          │        inconclusive │
                 │                          │             │       │
                 │  request_evaluation ◀────┼─────────────┘       │
                 │  (retry, allowed only    │  open_dispute(claim, grounds)
                 │   from inconclusive or   │                     │
                 │   evidence_collected)    │                     ▼
                 │                          │                 disputed
                 │                          │                     │
                 │                          │        resolve_dispute(claim)
                 │                          │                     │
                 │                          │                     ▼
                 │                          │        pending_evaluation → decided_* / inconclusive
                 │                          │
                 │                    finalize_decision(claim)   [finality gate]
                 │                          │
                 │                          ▼
                 │                  decided_confirmed + finalized
                 │                          │
                 │                 settle_claim(claim)  [owner only, idempotent]
                 │                          │
                 │                          ▼
                 │                      settled
                 └── (retry) ──▶ request_evaluation
```

## States

| State | Meaning |
|---|---|
| `created` | Claim exists; evidence not yet requested. |
| `pending_evaluation` | Transient state written at the start of an evaluation tx; always replaced before the tx commits. |
| `evidence_collected` | Evidence was fetched but evaluation could not complete (all sources unreachable). Retryable. |
| `decided_confirmed` | Evidence met the policy condition under the stated rules. |
| `decided_not_confirmed` | Evidence did not meet the condition. |
| `inconclusive` | Evidence was incomplete or sources conflicted. A legitimate result, not an error. |
| `disputed` | A dispute was opened; the claim will be re-evaluated. |
| `settled` | Payout emitted after finality (Settlement Controller). |

## Transitions (enforced)

| From | Method | To | Guard |
|---|---|---|---|
| — | `start_claim` | `created` | policy active; period valid and not in the future for archive mode; not a duplicate of (policy, period); payout beneficiary is the claimant |
| `created` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | claim belongs to caller or caller is owner |
| `inconclusive` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | retry allowed |
| `evidence_collected` | `request_evaluation` | `decided_*` / `inconclusive` / `evidence_collected` | retry after `EXTERNAL` |
| `decided_confirmed` / `decided_not_confirmed` / `inconclusive` | `open_dispute` | `disputed` | claimant or owner; disputes remaining (< `MAX_DISPUTE_ROUNDS`) |
| `disputed` | `resolve_dispute` | `decided_*` / `inconclusive` | claimant or owner; increments `eval_round` |
| `decided_confirmed` | `finalize_decision` | `decided_confirmed` + `finalized=true` | owner only; finality read at `LATEST_FINAL` must match the recorded decision |
| `decided_confirmed` + `finalized` | `settle_claim` | `settled` | owner only; not already settled; amount > 0; contract balance sufficient |

## Rejected (tested) transitions

- `start_claim` duplicate of the same (policy, period) → `EXPECTED: duplicate claim`
- `request_evaluation` from a `decided_*` state without a dispute → `EXPECTED: claim already decided`
- `open_dispute` from `created` / `evidence_collected` / `disputed` → `EXPECTED: cannot dispute`
- `open_dispute` when dispute rounds are exhausted → `EXPECTED: dispute limit reached`
- `resolve_dispute` from a non-`disputed` state → `EXPECTED: not disputed`
- `finalize_decision` from a non-`decided` state → `EXPECTED: not decided`
- `finalize_decision` when the finality read does not match → `EXPECTED: decision not final`
- `settle_claim` before `finalized` → `EXPECTED: decision not final`
- `settle_claim` when `decision != confirmed` → `EXPECTED: claim not confirmed`
- `settle_claim` twice → `EXPECTED: already settled`
- `settle_claim` by a non-owner → `EXPECTED: not owner`

## Repeated claim attempts

- A second `start_claim` for the **same `(policy_id, period_start, period_end)`**
  is rejected deterministically; the original `claim_id` is returned in the
  error text is not needed — the index `claim_index[policy_id|start|end]`
  holds the existing id and is exposed via the `find_claim` view.
- Retrying an **inconclusive** claim is done with `request_evaluation`, not a new
  claim.
- Retrying after an **`EXTERNAL`** failure is likewise `request_evaluation` from
  `evidence_collected`.
