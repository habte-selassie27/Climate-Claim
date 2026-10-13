# Historical fixtures

These are **recorded historical weather records**, labeled
`historical_simulation` everywhere they are used. Every value is the exact
response returned by the documented endpoints in [`../../docs/sources.md`](../../docs/sources.md),
trimmed to the fields the contract reads. They back the direct tests and the
eight demo scenarios. **They are not a live feed.**

| File | Location | Period | Sources |
|---|---|---|---|
| `london_2024-06-01_2024-06-05.json` | London (51.505, −0.055) | 2024-06-01..05 | Open-Meteo ERA5, NASA POWER MERRA-2 |
| `paris_2024-06-01_2024-06-05.json` | Paris (48.8566, 2.3522) | 2024-06-01..05 | Open-Meteo ERA5, NASA POWER MERRA-2 |

Both were **re-verified against the live endpoints on 2026-10-13** and the
values matched exactly, so these are genuine records rather than hand-written
examples.

## London — two reanalyses that genuinely disagree

| Date | Open-Meteo `precipitation_sum` (mm) | NASA POWER `PRECTOTCORR` (mm) |
|---|---|---|
| 2024-06-01 | 0.10 | 0.23 |
| 2024-06-02 | 0.00 | 0.04 |
| 2024-06-03 | 0.20 | 0.19 |
| 2024-06-04 | **1.10** | **2.03** |
| 2024-06-05 | 0.00 | 0.02 |

ERA5 peaks at 1.10 mm and MERRA-2 at 2.03 mm. Against a **1.50 mm** threshold
with a `unanimous` rule, one source crosses and the other does not — the
`source_conflict` case, and the clearest argument for GenLayer here.

## Paris — the data behind the on-chain claims

| Date | Open-Meteo `precipitation_sum` (mm) | NASA POWER `PRECTOTCORR` (mm) |
|---|---|---|
| 2024-06-01 | **1.20** | 3.79 |
| 2024-06-02 | 0.00 | 0.29 |
| 2024-06-03 | 0.10 | 0.09 |
| 2024-06-04 | 0.80 | 0.14 |
| 2024-06-05 | 0.50 | 0.66 |

Highest reading 1.20 mm. This is exactly what claims 2, 4 and 5 evaluated, and
it reproduces their on-chain results exactly (station `48.8928,2.2920`,
`observed_value_scaled: 120`).

Note the grid cell: Open-Meteo answered the Paris request with
`48.89279, 2.2920206`, about **5 973 m** from the requested point. That single
fact is why `claim-4` is `inconclusive / location_mismatch` at a 5 km tolerance
while `claim-2` is `confirmed` at 12 km.

The Paris MERRA-2 column is kept for reference but is not used by any scenario:
on these particular days MERRA-2 (3.79 mm) is further above the threshold than
ERA5, so the two never disagree about *crossing*. The London pair does.

## Which scenario each fixture backs

| Scenario | Fixture | Outcome | Verifying test |
|---|---|---|---|
| Threshold clearly crossed | London | confirmed | `test_clearly_above_threshold` |
| Threshold clearly not reached | Paris | not confirmed | `test_clearly_below_threshold` |
| Exactly at the threshold | London (1.10 vs `> 1.10`) | not confirmed | `test_exactly_at_threshold_gt_is_not_crossed` |
| Conflicting sources | London, both sources | inconclusive | `test_unanimous_conflict_is_inconclusive` |
| Missing observations | London, day 5 dropped | inconclusive | `test_gap_in_period_is_inconclusive` |
| Location mismatch | Paris, 5 km tolerance | inconclusive | `test_location_mismatch` |
| Repeated claim attempt | contract behaviour | `EXPECTED: duplicate claim` | `test_duplicate_claim_rejected` |
| Dispute and re-evaluation | contract behaviour | round increments | `test_dispute_flow_records_history` |

## Rules for editing these files

- Never hand-edit a value to make a scenario pass. If a scenario needs different
  data, record a new capture with the URL and timestamp, as above.
- A missing day is `null`, never zero and never interpolated. The contract
  refuses to estimate, and the UI draws it as a hatched gap.
- Keep `label: "historical_simulation"`. Anything presented as live is a
  labelling bug.