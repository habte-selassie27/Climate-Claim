# Equivalence design

> **WHAT IS DEPLOYED, AND WHAT IS NOT.**
>
> This page describes two things, and the difference matters.
>
> **DEPLOYED** — `ClimatePolicy.compute_evaluation(policy_json, evidence_json,
> days_expected)` derives a decision from a frozen policy and a set of evidence
> rows. It is a **pure function**: no web access, no model call, no storage
> reads, no clock. It recomputes each row's `crossed` flag from the raw scaled
> value and the threshold rather than trusting it, applies the agreement rule,
> and returns the decision. So the decision is **derived on chain** rather than
> asserted by the owner — which was the previous behaviour and the reason
> `record_evaluation` was unverifiable.
>
> **NOT DEPLOYED** — everything below about the consensus equivalence rule,
> leader/validator disagreement and the model-assisted reading of policy wording.
> That belongs to `archive/climateclaim.py`, the pre-split contract, which is
> not deployed and cannot be: at ~63 KB it is far above the ~19 KB deploy
> ceiling both testnets enforce. See
> [`deployment-bradbury-2026-10-18.md`](deployment-bradbury-2026-10-18.md).
>
> The honest summary: what is deployed makes the decision **verifiable**. It is
> not, and does not claim to be, a consensus judgement over non-deterministic
> interpretation. The equivalence rule below is the design for that, preserved
> with its tests, ready for a network with the headroom.

GenLayer validators agree on the **meaning** of a non-deterministic result, not
on exact bytes. Everything the deployed contracts can decide with plain code,
they decide with plain code.

---

## CALL NAME: `evaluate_claim_evidence`

**PURPOSE** — decide whether retrieved weather evidence confirms a policy's
condition, using the eligible documented sources.

**INPUTS** — a normalized `policy_data` dict (scalars only, read from storage
*before* the nondet block) and a bounded `source_plan` list built from the
policy's **frozen source snapshot** (source id, kind, URL, parameter name,
metric, unit, and the policy's `data_mode`). The observation window is the
**claim's own** `period_start`/`period_end`, never the policy's.

**NON-DETERMINISTIC SOURCE** — `gl.nondet.web.get(...)` HTTP fetch **plus**
`gl.nondet.exec_prompt(...)` LLM interpretation.

**LEADER PRODUCES** — a JSON-encodable dict:

```
{
  "decision":      "confirmed" | "not_confirmed" | "inconclusive",
  "reason_code":   <enum>,
  "observed_value_scaled": <int, fixed-precision x100>,
  "checks": {
     "threshold_crossed": "pass"|"fail"|"unclear",
     "period_covered":    "pass"|"fail"|"unclear",
     "location_match":    "pass"|"fail"|"unclear",
     "source_agreement":  "pass"|"fail"|"unclear",
     "data_completeness": "pass"|"fail"|"unclear"
  },
  "sources_used":   [<id>, ...],
  "sources_missing":[<id>, ...],
  "summary": "<one sentence, non-consensus-critical>"
}
```

**VALIDATOR CHECKS** — independently runs the **same** `leader_fn` (re-fetching
the same eligible sources and re-running the same LLM prompt) and compares its
own structured result to the leader's using the equivalence rule below. The
validator also enforces the threshold-side invariant, so validators can never
"agree on garbage."

**EQUIVALENCE RULE** (implemented in `_equivalent`)

1. `decision` must be **exactly equal**.
2. `reason_code` must be equal **or** fall inside the same documented group.
   In the deployed contract every group is currently a **singleton**
   (`REASON_GROUPS` at archive/climateclaim.py:73-80 lists
   `source_conflict`, `missing_observations`, `location_mismatch`,
   `threshold_crossed`, `threshold_not_crossed`, `sources_unreachable`, each
   alone), so in practice reason_code must match exactly. The grouping mechanism
   exists so two semantically-equivalent codes could be tolerated without
   loosening the rule; no such pair is currently defined.
3. **Required** checks must be equal: `threshold_crossed`, `period_covered`,
   `data_completeness`.4. **Non-required** checks (`location_match`, `source_agreement`) must be equal,
   *except* that leader `unclear` may be tolerated when the validator is definite.
4a. **Location authority.** A definite decision may not carry a failing
   `location_match` on either side, and a `location_mismatch` result must
   actually carry a failing location check on both. This is what stops a
   `confirmed`/`not_confirmed` outcome from coexisting with a location failure
   (the evaluator reconciles this before the result is ever written, and the
   rule enforces it again at consensus time).
5. `observed_value_scaled` must be within an **absolute tolerance of `SCALE`
   (=1.00 in native units)** and on the **same side of the threshold** as the
   decision.
6. **Invariant** — reject (return `False`) if `decision == "confirmed"` but the
   observed value does not satisfy the comparator, or `decision ==
   "not_confirmed"` but it does.
7. `sources_used` / `sources_missing` must be set-equal when the decision is
   definite.

**TOLERANCE** — numeric: ±1.00 native unit on the observed value. None on the
`decision` enum and none on required checks.

**NORMALIZATION STEPS** — unit conversion to the metric's canonical unit
(mm / °C), UTC calendar dates via ISO strings, per-source readings sorted by
date, values scaled to integers by 100.

**FAILURE MODES** — source down / timeout / non-JSON / changed layout;
contradictory sources; partial coverage; location mismatch; unusable LLM output.

**FAILURE BEHAVIOR** — see the table below.

**WHY NOT `strict_eq`** — the fetched payloads are large and change over time,
and an LLM's JSON key ordering / phrasing is not byte-stable. `strict_eq` would
make validators disagree on cosmetic differences. We therefore use a custom
leader/validator pair and compare *meaning*.

**WHERE THE LLM IS USED (and where it is not)** — the LLM produces only the
human `summary` and a *semantic* `location_match` judgement **when the providers
reported no coordinates at all**. When coordinates are present the integer
proximity check is authoritative and the model's verdict is ignored; if the
model's verdict is `fail`, the evaluator forces `inconclusive` /
`location_mismatch` before the result is written. **Threshold arithmetic,
aggregation, unit conversion, and the final `decision` are plain integer code.**
The LLM never invents a reading and never computes the threshold comparison.

---

## Failure behavior table

| Situation | Behavior |
|---|---|
| All eligible sources unreachable | `EXTERNAL: sources_unreachable`; no decision recorded; state `evidence_collected`; retryable |
| Some sources unreachable, ≥`min_sources` reachable | proceed with the reachable ones; unreachable ids listed in `sources_missing` |
| Source reachable, zero readings in period | `inconclusive` / `missing_observations` |
| Partial coverage where the aggregation needs every day | `inconclusive` / `missing_observations` |
| Sources contradict on threshold crossing | `inconclusive` / `source_conflict` (unless the policy's explicit `agreement_rule` resolves it) |
| `majority` rule with an equal split (a tie) | `inconclusive` / `source_conflict`: a tie is ambiguity, never a silent `not_confirmed` |
| Provider repeats a date inside the window | that source fails with `EXTERNAL: duplicate_dates`; it contributes neither readings nor coverage |
| Reported location outside the policy tolerance | `inconclusive` / `location_mismatch` |
| Model says the location does not match, coordinates absent | `inconclusive` / `location_mismatch` — the model can never leave a definite decision standing on top of a failing location |
| LLM output unusable | summary falls back to a deterministic sentence; `location_match` falls back to the deterministic coordinate check → never `LLM_ERROR` for a non-critical field. `LLM_ERROR` only if the LLM is required and returns nothing usable |
| Value outside plausible bounds (`|value| > 100000` scaled) | `EXTERNAL: implausible_value`; source record marked failed |
| Validators disagree materially | handled by GenLayer consensus/appeal; never overridden locally |

---

## TESTS COVERING THIS

Direct (`tests/direct/`), all with mocked web + LLM — 114 tests across seven
files. The scenario coverage that the equivalence rule depends on lives mostly in
`test_equivalence.py`, `test_evaluation.py` and `test_llm_parsing.py`:

- `test_equivalence.py` (11) — `_equivalent` on near-equal vs clearly-different
  results (`test_near_equal_is_equivalent`,
  `test_clearly_different_observed_not_equivalent`); decision / reason-code /
  required-check / source mismatches; optional-check `unclear` tolerance; and the
  threshold-side invariant in both directions
  (`test_invariant_confirmed_below_threshold_rejected`,
  `test_invariant_not_confirmed_above_threshold_rejected`).
- `test_evaluation.py` (26) — threshold boundary cases (clearly above / below /
  exactly-at for `gt` and `gte` / crossing only on the first or last day);
  aggregation rules (cumulative, consecutive_days pass and fail);
  conflicting sources under `unanimous` vs `any`
  (`test_unanimous_conflict_is_inconclusive`, `test_any_rule_resolves_conflict`);
  missing observations and no-interpolation (`test_gap_in_period_is_inconclusive`,
  `test_empty_body_source_missing`, `test_no_interpolation`); location mismatch
  vs within-tolerance; out-of-period readings ignored; unit normalisation
  (`test_inch_units_normalized`) and unsupported-unit rejection; source-down
  partial vs all-unreachable; malformed payload and changed layout.
- `test_llm_parsing.py` (9) — valid, malformed, missing-keys, wrong-types,
  unknown-enum, extra-commentary LLM output; `test_llm_cannot_override_decision`;
  `test_prompt_injection_in_evidence_ignored`; LLM raising is tolerated.
- `test_state_machine.py` (14) — every valid transition and the invalid ones;
  dispute flow including grounds round-tripping
  (`test_dispute_flow_records_history`, `test_dispute_grounds_round_two`) and the
  dispute limit; duplicate-claim rejection; retry after inconclusive and after
  `EXTERNAL`; unauthorized evaluation.
- `test_settlement.py` — the two-phase lifecycle: emission is not delivery
  (`test_settle_emits_the_payout_without_claiming_delivery`), verified
  confirmation, double-settle and second-in-flight rejection, the finality gate
  (available / mismatched / missing), non-owner rejection, insufficient balance,
  zero payout, operator-recorded failure with retry, `__on_errored_message__`
  refunding a failed message (single in-flight vs ambiguous), and the payout
  recipient rule (beneficiary, override, zero-address-means-claimant).
- `test_contract_audit.py` — one section per contract-audit finding: claim-scoped
  windows, frozen sources and final registrations, data-mode enforcement,
  dispute counting and failed-reevaluation recovery, round-specific finality,
  majority ties, duplicate dates, the aggregation/unit rules, location
  authority, and the source listing.
- `test_policy_registry.py` (20) — field validation (period order/length, source
  count/duplicates/metric, consecutive-days-requires-precipitation), owner-only
  guards, retire and beneficiary locks.
- `test_smoke.py` (6) — deploy state, policy+claim creation, the bulk
  `list_claims` view agreeing with `get_claim`, and confirmed / not_confirmed /
  conflicting-sources happy paths.
