# ClimateClaim — deployment record and evidence pack

Everything below was produced by running the commands shown. Nothing here is
reconstructed, and no hash or address was invented. Where a value could not be
verified, that is stated explicitly rather than filled in.

> **Stale relative to the contract source (read this first).** Every address,
> hash, receipt and schema in this file was captured from the contract as it
> stood **before** the contract audit fixes. `contracts/climateclaim.py` has
> changed since: criteria version `climateclaim-criteria-2`, claim-scoped
> observation windows, per-policy frozen source snapshots, enforced `data_mode`,
> round-specific finality, two-phase settlement (`confirm_settlement`,
> `fail_settlement`, `get_in_flight`, `get_refunds`, `get_payouts`,
> `get_source_count`) and the aggregation/unit rules. The deployment is kept
> because it is real evidence of a real deployment; it must be **redeployed and
> re-captured** before anything is wired to it. Details in `CHANGELOG.md`.

- **Network:** GenLayer StudioNet (`studionet`), chain id `61999`
- **RPC:** `https://studio.genlayer.com/api`
- **Explorer:** `https://explorer-studio.genlayer.com` — serving (verified
  2026-10-16); transaction deep links use the `/tx/<hash>` route. The
  `genlayer-explorer.vercel.app` alias from the chain definition is the one
  that returns DEPLOYMENT_PAUSED.
  (`DEPLOYMENT_PAUSED`, verified 2026-10-13). See "Known gaps".

---

## 1. Contract

| Field | Value |
|---|---|
| Contract file | `contracts/climateclaim.py` |
| Contract address | `0xE16032420e3155C0822e9150a98c6B1163869F0c` |
| Owner / claimant | `0x5B3661C576c7001e6d6279C67F3779705d334c89` (local `rabby` account) |
| Pinned GenVM `Depends` | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |
| Methods in schema | 25 (14 view, 11 write) |
| Schema saved at | `docs/schema.json` (strict JSON), raw CLI output at `docs/schema.genlayer-cli.txt` |
| Criteria version | `climateclaim-criteria-1` |

> **Post-deploy step required.** The contract seeds no sources itself; its
> registry starts empty and holds only what an owner registers. Any deployment
> must be seeded before a policy can be created:
>
> ```bash
> ./scripts/seed-sources.sh <contract-address>
> ```
>
> Until then every `create_policy` reverts with `EXPECTED: unknown source`. See
> `docs/sources.md` and `docs/sources.json`.

Verified live (`artifacts/studionet/01-…`, `02-…`):

```
$ genlayer call 0xE16032420e3155C0822e9150a98c6B1163869F0c get_policy_count
Result: 6

$ genlayer call 0xE16032420e3155C0822e9150a98c6B1163869F0c get_claim_count
Result: 5
```

The deployment transaction hash for the original deploy predates this work and
was never captured in full, so it is left blank rather than guessed. An earlier
changelog entry quoted a truncated `0x18e9a346...0e28`, which is not a usable
hash and has not been treated as one.

---

## 2. On-chain claims

Five claims, each read back from the chain into `artifacts/studionet/20-…` through
`23-…`. Machine-readable snapshot: `frontend/src/data/onchain-snapshot.json`.

| Claim | Policy | State | Decision | Reason | Observed | Checks | Finalized |
|---|---|---|---|---|---|---|---|
| claim-1 | policy-1 | `evidence_collected` | — | `EXTERNAL: sources_unreachable` | 0.00 mm | 0 | no |
| claim-2 | policy-3 | `decided_confirmed` | `confirmed` | `threshold_crossed` | 1.20 mm | 5 pass | no |
| claim-3 | policy-2 | `created` | — | not evaluated | — | 0 | no |
| claim-4 | policy-4 | `inconclusive` | `inconclusive` | `location_mismatch` | 1.20 mm | 2 pass / 1 fail / 2 unclear | no |
| claim-5 | policy-5 | `decided_not_confirmed` | `not_confirmed` | `threshold_not_crossed` | 1.20 mm | 4 pass / 1 fail | no |

**No claim is finalized.** Every one reports `finalized: false`, so the UI shows
*Accepted — can still be appealed* and never claims finality it cannot show.

### Policies

Six exist. `policy-6` is retired (see transactions below).

| Policy | Threshold | Tolerance | Claims |
|---|---|---|---|
| policy-1 | `> 2.00 mm` | 5 000 m | 1 (claim-1) |
| policy-2 | `> 0.00 mm` | 5 000 m | 1 (claim-3) |
| policy-3 | `> 1.00 mm` | 12 000 m | 1 (claim-2) |
| policy-4 | `> 5.00 mm` | 5 000 m | 1 (claim-4) |
| policy-5 | `> 5.00 mm` | 12 000 m | 1 (claim-5) |
| policy-6 | `> 5.00 mm` | 12 000 m | 0 — retired |

---

## 3. Transactions

Every hash below was re-verified with `genlayer receipt`; full output is in
`artifacts/studionet/30-…` through `36-…`. **All seven are FINALIZED with
`execution_result: 'SUCCESS'`.**

| # | Action | Tx hash |
|---|---|---|
| 1 | `create_policy` → policy-4 | `0xc77b77b51140b8d55dfb1c60249edeb1dc2fb2b2f66bf6fcbb39dd7566e0b98b` |
| 2 | `start_claim` → claim-4 | `0xa4f7f059570a43f8074fe138a91f76341685d1843a70b21398d0b7647749298c` |
| 3 | `request_evaluation` → claim-4 | `0x841dfb125e9f2c59a0a0bef3a83e3818f4cf35c97bef0240a81b3ff5d072bfec` |
| 4 | `create_policy` → policy-5 | `0xd57da882ed90250a6566da3b90b0485f5e08e9630af8e675ac8ac4dbff26076c` |
| 5 | `start_claim` → claim-5 | `0x1acec44c78dd63c7b7cd0014ea531a5491375e827ac2ae3df322037880c7d346` |
| 6 | `request_evaluation` → claim-5 | `0x1b87c46dbcae997058539638e36df6b921658c97a8eb305990399ab7a753d0e1` |
| 7 | `retire_policy` → policy-6 | `0xc36aa6004a030d3c4d068fe5879fd08684aa57d7c3fadac29735a9f34ae64fc6` |

Raw write output is retained for transactions 4–7 (`artifacts/studionet/10-…`
through `16-…`). For 1–3 the receipts are the proof; the original console logs
were lost (see "Known gaps" #7).

`claim-3` was also created on chain by a real `start_claim`, but that hash was
lost to console truncation and is deliberately not listed. The claim itself is
real and readable.

---

## 4. The location-mismatch result is organic

`claim-4` was expected to be `not_confirmed`. It came back
`inconclusive / location_mismatch`, which is worth recording because it shows the
contract behaving correctly on real data:

- Policy-4 asked for Paris (48.8566, 2.3522) with a **5 000 m** tolerance.
- Open-Meteo ERA5 answered with grid cell `48.89279, 2.2920206` — about
  **5 973 m** away, outside that tolerance.
- The same coordinates under policy-3's **12 000 m** tolerance gave `confirmed`
  (claim-2).

The distance rule alone flips the outcome. Recorded checks for claim-4:

```
threshold_crossed   unclear
period_covered      pass
location_match      fail        <- the actual cause
source_agreement    unclear
data_completeness   pass
```

The validator's summary correctly defers to the computed decision:

> "The recorded precipitation was 1.20 mm, but the claim is currently
> inconclusive due to a location mismatch between the policy and the weather
> station."

That is the deterministic-code / model-interpretation split working as designed.

---

## 5. Quality gates

| Gate | Command | Result |
|---|---|---|
| Lint | `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py` | **Lint passed (3 checks) + Validation passed**, 25 methods |
| Direct tests | `pytest tests/direct/ -q` | **112 passed** |
| Integration tests | `gltest tests/integration/` | **Not present** — see known gaps #2 |
| UI typecheck | `npx tsc -b --noEmit` (frontend/) | clean |
| UI build | `npm run build` (frontend/) | built |

> **Lint reproducibility.** Bare `genvm-lint check` resolves the newest cached
> GenVM (`genlayerlabs-genvm-manager-v0.6.0-rc3`) and fails with
> `Failed to load SDK`. `GENVM_VERSION=v0.3.0-rc7` is required for it to load
> the pinned `py-genlayer` SDK.

---

## 6. UI evidence

Screenshots in `artifacts/screenshots/`, captured with
`node scripts/screenshot.mjs` against the production build.

| File | Shows |
|---|---|
| `01-landing.png` | Pitch plus a live conflict chart |
| `02-demo-source-conflict.png` | Replay scenario, two disagreeing sources |
| `03-demo-location-mismatch.png` | On-chain scenario, 5 checks read from chain |
| `04-demo-missing-observations.png` | Hatched gap, no interpolation |
| `05-demo-repeated-attempt.png` | `EXPECTED: duplicate claim` rejection |
| `06-claims-table.png` | All 5 real claims |
| `07-claim-2-confirmed.png` | Confirmed decision, full evidence + audit |
| `08-claim-4-inconclusive-location.png` | Mixed pass/fail/unclear checks |
| `09-claim-5-not-confirmed.png` | Not confirmed, threshold failed |
| `10-claim-1-external-error.png` | Mapped error, honest empty states |
| `11-policies.png`, `12-policy-3-detail.png` | Policy registry |
| `13-how-it-works.png` | Equivalence, finality, limitations |
| `14-claim-2-mobile-360.png` | 360 px responsive check |

`screenshot-report.json` records per page the detected overflow flag and the
live/snapshot origin. **No page overflows horizontally**, and every chain-backed
page reports `Live from StudioNet`.

---

## 7. Known gaps — stated, not hidden

1. **Explorer status changed after capture — resolved.** The
   `genlayer-explorer.vercel.app` alias returned `DEPLOYMENT_PAUSED` when this
   record was captured. The official explorer now serves at
   `https://explorer-studio.genlayer.com` (verified 2026-10-16) and the app
   links to it via the verified `/tx/<hash>` route. If any network's explorer
   goes down, links render *disabled with a reason* rather than as dead links.
2. **No integration tests.** `tests/integration/` does not exist, so gate 3 of
   the AGENTS.md sequence has never run. Everything on-chain came from real
   writes against StudioNet instead.
3. **No finalized claim.** Finality is implemented and unit-tested but not
   demonstrated on chain. Nothing here shows a settled payout.
4. **No Bradbury/Asimov deployment.** StudioNet only, so no public-proof address.
5. **Payout amounts are zero** on every policy, so settlement cannot be walked
   end to end.
6. **`claim-1`'s evaluation failed** with `EXTERNAL: sources_unreachable` (NASA
   POWER unreachable at the time). Kept deliberately as the error-state example;
   it is retryable.
7. **Some raw console logs were lost.** An earlier `gltest.config.yaml` pointed
   at `artifacts/`, so every `pytest` run cleared the directory and deleted the
   evidence pack, including raw write logs for transactions 1–3 and this file.
   Fixed by scoping gltest to `artifacts/gltest`. The transaction hashes survive
   and were re-verified from the chain; only the original log files are gone.
8. **`policy-6` exists because of a mistake.** A re-run of the scenario script
   was launched intending only to re-dump logs, but it writes to the chain and
   created a duplicate policy before it was stopped. It has no claims and has
   been retired on chain (transaction 7) rather than left as a stray. Claims
   were unaffected.

---

## 8. Reproducing this

```bash
# 1. Contract gates
pip install -r requirements.txt
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/climateclaim.py
pytest tests/direct/ -q

# 2. On-chain reads (read-only; safe to re-run)
bash scripts/capture-studionet-readonly.sh

# 3. Rebuild the frontend and refresh the snapshot
cd frontend && npm install && npm run capture && npm run build

# 4. Re-capture screenshots
npx vite preview --port 4173 &
node scripts/screenshot.mjs
```

> The public RPC is limited to **30 requests/minute** (`-32029`). Both
> `npm run capture` and the frontend's service layer space their reads to stay
> inside that.

> `scripts/studionet-not-confirmed-scenario.sh` performs **writes** to deployed
> state. Read this before running it: it will create new policies and claims.