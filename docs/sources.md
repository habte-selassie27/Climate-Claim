# Source registry

> **The contract seeds nothing.** `ClimateClaim`'s source registry starts empty
> and holds only what an owner registers through the owner-only
> `register_source` write. The contract carries no hardcoded knowledge of any
> provider.
>
> The canonical catalogue is [`sources.json`](sources.json). Seed a deployment with:
>
> ```bash
> ./scripts/seed-sources.sh <contract-address>
> ```
>
> Until a deployment is seeded, every `create_policy` reverts with
> `EXPECTED: unknown source` — the contract validates a policy's sources against
> the registry rather than trusting arbitrary identifiers.

Measurable weather facts in ClimateClaim come from **documented, authoritative
public weather-data endpoints** that need no API key or cookies. The Intelligent
Contract extracts only small structured facts (date, value, unit, reported
location) from their JSON responses. It never scrapes whole pages and never
follows instructions found in fetched content.

All endpoints below were verified live (HTTP 200, JSON body) on 2026-10-13.

## Registered sources

| id | provider | kind | URL pattern | fields used | native unit | cadence | auth | attribution / terms |
|---|---|---|---|---|---|---|---|---|
| `om_archive_precip` | Open-Meteo Historical Weather API | archive | `https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}&daily=precipitation_sum&timezone=UTC` | `daily.time[]`, `daily.precipitation_sum[]`, `daily_units.precipitation_sum`, `latitude`, `longitude` | mm / day | ERA5 reanalysis, ~5 day lag | none | Open-Meteo data is CC BY 4.0; free for non-commercial use (< 10k req/day). https://open-meteo.com/en/terms |
| `om_archive_tmax` | Open-Meteo Historical Weather API | archive | same base, `daily=temperature_2m_max` | `daily.temperature_2m_max[]`, `daily_units.temperature_2m_max` | °C | ERA5 reanalysis | none | as above |
| `om_forecast_precip` | Open-Meteo Forecast API | live | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum&past_days={days}&forecast_days=1&timezone=UTC` | `daily.time[]`, `daily.precipitation_sum[]` | mm / day | hourly model runs | none | as above |
| `nasa_precip` | NASA POWER Daily API v2 | archive | `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=RE&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON` | `properties.parameter.PRECTOTCORR.{YYYYMMDD}`, `parameters.PRECTOTCORR.units`, `geometry.coordinates` | mm / day | MERRA-2, ~3 day lag | none | NASA POWER, public domain / open data. https://power.larc.nasa.gov/ |
| `nasa_tmax` | NASA POWER Daily API v2 | archive | same base, `parameters=T2M_MAX` | `properties.parameter.T2M_MAX.{YYYYMMDD}`, `parameters.T2M_MAX.units` | °C | MERRA-2 | none | as above |

## Why two providers

Open-Meteo (ERA5 reanalysis) and NASA POWER (MERRA-2) are **independent
reanalyses**. They agree on the broad shape of a period but differ in
magnitude, which is exactly the real-world situation ClimateClaim's
`source_agreement_rule` exists to handle. For example, for London
(51.505, -0.055) on 2024-06-04:

- Open-Meteo archive: `precipitation_sum` = 1.10 mm
- NASA POWER: `PRECTOTCORR` = 2.03 mm

Both agree 2024-06-04 was the wettest day in 2024-06-01..05; they disagree on
the magnitude. A daily-total threshold of 1.5 mm therefore produces a genuine
**source conflict** — a first-class `inconclusive` outcome, not an error.

## Normalization

- **Units:** every value is converted to the metric's canonical unit
  (`precipitation` → mm, `temperature` → °C) and stored as a **fixed-precision
  integer scaled by 100** (`SCALE = 100`). No floats are ever stored.
- **Time:** all requests pin `timezone=UTC` where the provider supports it;
  NASA POWER reports `time_standard: LST` but its daily fields are keyed by
  `YYYYMMDD`, which we read as the UTC calendar date. Period comparison is
  ISO-8601 `YYYY-MM-DD` string comparison.
- **Sorting:** per-source readings are sorted by date before aggregation.

## Failure behavior

| Situation | Behavior |
|---|---|
| HTTP error / timeout / non-JSON body for a source | that source's record is `ok=false` with `EXTERNAL: fetch_failed`; other sources still count |
| all eligible sources unreachable | `EXTERNAL: sources_unreachable`, no decision recorded, retryable |
| source reachable but returns no readings in the period | `ok=true` with zero days → contributes to `missing_observations` |
| provider changes its JSON layout | our strict field extraction yields `EXTERNAL: parse_failed` for that source, never a guessed value |

## Historical vs live labeling

- Sources of kind `archive` are used by policies whose `data_mode` is
  **`historical_simulation`**. Their period is in the past and results are
  reproducible.
- `om_forecast_precip` is the only **`live`** source. A policy may only use it
  when its `data_mode` is `live`, and the label travels with the policy and the
  claim into the UI.
