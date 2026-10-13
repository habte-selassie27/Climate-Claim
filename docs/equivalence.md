# Equivalence design

GenLayer validators agree on the **meaning** of a non-deterministic result, not
on exact bytes. ClimateClaim has exactly one consensus-critical non-deterministic
call. Everything it can decide with plain code, it decides with plain code.

---

## CALL NAME: `evaluate_claim_evidence`

**PURPOSE** — decide whether retrieved weather evidence confirms a policy's
condition, using the eligible documented sources.

**INPUTS** — a normalized `policy_data` dict (scalars only, read from storage
*before* the nondet block) and a bounded `source_plan` list (source id, kind,
URL, parameter name, metric, unit). The observation period `start`/`end`.

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
2. `reason_code` must be equal **or** fall inside the same documented group
   (e.g. `source_conflict` ≡ `insufficient_agreement`).
3. **Required** checks must be equal: `threshold_crossed`, `period_covered`,
   `data_completeness`.
4. **Non-required** checks (`location_match`, `source_agreement`) must be equal,
   *except* that leader `unclear` may be tolerated when the validator is
   definite.
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
human `summary` and a *semantic* `location_match` judgement when the providers'
reported coordinates are ambiguous. **Threshold arithmetic, aggregation, unit
conversion, and the final `decision` are plain integer code.** The LLM never
invents a reading and never computes the threshold comparison.

---

## Failure behavior table

| Situation | Behavior |
|---|---|
| All eligible sources unreachable | `EXTERNAL: sources_unreachable`; no decision recorded; state `evidence_collected`; retryable |
| Some sources unreachable, ≥`min_sources` reachable | proceed with the reachable ones; unreachable ids listed in `sources_missing` |
| Source reachable, zero readings in period | `inconclusive` / `missing_observations` |
| Partial coverage where the aggregation needs every day | `inconclusive` / `missing_observations` |
| Sources contradict on threshold crossing | `inconclusive` / `source_conflict` (unless the policy's explicit `agreement_rule` resolves it) |
| Reported location outside the policy tolerance | `inconclusive` / `location_mismatch` |
| LLM output unusable | summary falls back to a deterministic sentence; `location_match` falls back to the deterministic coordinate check → never `LLM_ERROR` for a non-critical field. `LLM_ERROR` only if the LLM is required and returns nothing usable |
| Value outside plausible bounds (`|value| > 100000` scaled) | `EXTERNAL: implausible_value`; source record marked failed |
| Validators disagree materially | handled by GenLayer consensus/appeal; never overridden locally |

---

## TESTS COVERING THIS

Direct (`tests/direct/`), all with mocked web + LLM:

- `test_equivalence.py` — `_equivalent` on near-equal vs clearly-different
  results; reason-code grouping; the confirmed-but-below-threshold invariant.
- `test_threshold.py` — clearly above / below / exactly at / boundary day.
- `test_aggregation.py` — max_single, daily_total, cumulative, consecutive_days.
- `test_conflict.py` — one source crosses, the other does not.
- `test_missing.py` — gaps, empty body, no interpolation.
- `test_location.py` — station outside tolerance.
- `test_period.py` — out-of-period readings ignored; timezone boundary.
- `test_units.py` — unit mismatch normalized / rejected.
- `test_llm_parsing.py` — malformed, missing keys, wrong types, out-of-range,
  extra commentary, unknown enums, and a prompt-injection fixture.
- `test_state_machine.py` — every valid and invalid transition.
- `test_settlement.py` — finality gate, double-settle, failed transfer,
  unauthorized caller, amount boundaries.
- `test_validation.py` — malformed submissions, bad period, retired policy,
  bad coordinates, bad comparator/aggregation.
