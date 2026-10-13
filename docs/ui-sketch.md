# UI sketch — ClimateClaim frontend as built

Derived from `UI.md` and the real components in `frontend/src/`. Wireframes show
the default (desktop) layout; responsive behaviour is noted per screen. Every
`[Component]` marker is an actual file in `frontend/src/components/` unless
marked **missing**.

---

## Global chrome (every route)

Rendered by `App.tsx` (`Header`, `Footer`).

```
+--------------------------------------------------------------+
| ▤ ClimateClaim     Home Demo Claims Policies How it works    |
|                   [◈ studionet]  [◉ 0x5B36…4c89 | Connect]  |
+--------------------------------------------------------------+
```

- Network badge from `config/network.ts` (`net.label`, chain id in tooltip).
- Wrong network → amber `Wrong network (chainId)` badge, `role="alert"`.
- No wallet → `Connect wallet` button; no `window.ethereum` → `Read-only`.
- Footer: contract address `CopyField`, network/chain, explorer link **only if
  `net.explorerAvailable`** (currently paused on StudioNet → muted note, no dead
  link), link to How it works.

Responsive: nav collapses under 640px; status badges wrap below nav.

---

## `/` — Landing (`pages/Landing.tsx`)

Job per UI.md §4.1: say what it is, show it working.

```
+--------------------------------------------------------------+
| Did the weather actually do that?                            |
| lede: checks recorded weather against a policy…              |
| [Open the demo] [See the source conflict] [See real claims]  |
+--------------------------------------------------------------+
| A real disagreement                      [▤ Historical sim]  |
| "Two reanalyses, same day: 1.10 mm vs 2.03 mm…"               |
| [EvidenceChart — conflicting-sources scenario]               |
+--------------------------------------------------------------+
| Why GenLayer                     | What it will not do        |
| sources down / disagree / …      | • invent readings          |
| validators compare meaning       | • LLM does arithmetic      |
| → How consensus… works           | • settle on accepted       |
+--------------------------------------------------------------+
```

- Chart is the live component fed by a real recorded scenario
  (`DEMO_SCENARIOS["conflicting-sources"]`), not an illustration.
- UI.md §4.1 asks for two actions; we render three (the third jumps straight to
  real on-chain claims, which serves the reviewer audience of §1).

---

## `/demo` — Demo mode (`pages/Demo.tsx`)

UI.md §8: eight preloaded scenarios, honest provenance labelling.

```
+----------------------------+---------------------------------+
| Demo mode                  | Scenarios                       |
| [▤ Historical simulation]  | › Threshold crossed (claim-2)   |
| [Open claim-2 on network]  |   Threshold not reached (5)     |
|                            |   Exactly at the threshold      |
| What this tests: …         |   Conflicting sources           |
|                            |   Missing observations          |
| [EvidenceChart for the     |   Location mismatch (claim-4)   |
|  selected scenario]        |   Repeated claim attempt        |
|                            |   Dispute round                 |
| Decision (demo preview):   |                                 |
|  ✓ Condition confirmed     | How to read this                |
|  reason + observed value   |  (shapes, hatch, threshold ink) |
+----------------------------+---------------------------------+
| Where the numbers come from (fixtures/historical/… files)    |
+--------------------------------------------------------------+
```

- Sidebar selects a scenario; `?scenario=` deep-links (Landing uses this).
- On-chain scenarios (`provenance: "on_chain"`) show a link to the real claim
  and read live data via `getClaimBundle`; the rest render recorded source data
  and say so. Contract-error scenarios (repeated attempt) render the mapped
  `EXPECTED: duplicate claim` message with the raw string in a disclosure —
  never a fake transaction (§8 rule).

---

## `/policies` — Policies list (`pages/Policies.tsx: Policies`)

```
| Policies                                             [OriginBadge] |
| lede: "…Once a claim references it, it cannot be changed."         |
+-------------------------------------------------------------------+
| Policy | Location | Condition | Data mode | Claims | Status        |
| policy-3 …  48.85, 2.29   > 5.00 mm   [▤ sim]   3   active        |
+-------------------------------------------------------------------+
```

- Skeleton rows while loading; empty state links to the demo.
- `OriginBadge` says `Live from StudioNet` or `recorded snapshot @time`.

## `/policies/:id` — Policy detail (`pages/Policies.tsx: PolicyDetail`)

```
| Policy policy-3  [▤ Historical simulation]  [OriginBadge]         |
| lede: policy sentence (plain-language summary)                    |
+-------------------------------------------------------------------+
| [info] "Referenced by a claim → immutable"  (only if claim_count>0)|
+-------------------------------------------------------------------+
| Terms                                    | Claims on this policy    |
| Condition / Location / tolerance         | 2 · decided_confirmed    |
| Period + timezone / metric / aggregation | 4 · inconclusive         |
| Sources / agreement / min sources        | (empty state if none)    |
| Payout / beneficiary                     |                          |
+-------------------------------------------------------------------+
```

- **Was missing, now built:** a "Start a claim" action. `StartClaimPanel.tsx`
  renders above "Claims on this policy" with period inputs (default = the
  policy window, `min`/`max` clamped to it), a duplicate pre-check via the
  contract's `find_claim` view, and the full tx lifecycle via `TxStatusPanel`.
  Disabled with a stated reason when the policy is retired, the wallet is on
  the wrong network, or no wallet is connected. Created claim's id is resolved
  from a live `find_claim` read after acceptance, never guessed.
  (`/policies/new` + `create_policy` — also now built; see the routes table.)

---

## `/claims` — Claims list (`pages/Claims.tsx`)

Not in UI.md's IA (which goes policy → claim), but every row is a real
on-chain claim, so it doubles as reviewer evidence.

```
| Claims                              [OriginBadge]                 |
| "Every claim below exists on the deployed contract at 0xE16…"     |
+-------------------------------------------------------------------+
| Claim | Policy | State | Decision      | Round | Final            |
| claim-2 | policy-3 | decided_confirmed | ✓ Confirmed | 0 | no     |
| claim-1 | policy-1 | inconclusive | ! Evaluation did not complete|  |
+-------------------------------------------------------------------+
```

- Decision column shows a failed evaluation distinctly (chip, not raw enum).
- Empty state invites the demo; skeleton rows while loading.

---

## `/claims/:id` — Claim detail (`pages/ClaimDetail.tsx`)

UI.md §4.4, the main screen. Real layout is a two-column `claim-grid`
(≥860px) with the evidence table full-width below — a deliberate deviation from
UI.md's single-column stack, because the 8-column evidence table is unreadable
in a half-width column.

```
+--------------------------------------------------------------+
| Claim claim-2  [▤ Historical simulation]  [OriginBadge]      |
| lede: policy sentence                                        |
| [DataModePanel: what historical simulation means]            |
+--------------------------------------------------------------+
| (wrong-network alert replaces nothing; renders above grid    |
|  when wallet is on the wrong chain)                          |
+----------------------------+---------------------------------+
| DECISION (DecisionPanel)   | CLAIM TIMELINE (ClaimTimeline)  |
| ✓ Condition confirmed      | 1 Created ✓                     |
| reason: threshold crossed  | 2 Evidence collected ✓          |
| "In the validator's words…"| 3 Evaluated — round 0 ●current  |
| Claim state / Highest      | 4 Disputed — "not used"         |
| reading / Threshold /      | 5 Settled (muted, disabled)     |
| Period / Round             | state blurb                     |
| [Accepted — can be         | Dispute history table (if any)  |
|  appealed | Final] strip   | Settlement line (if any)        |
+----------------------------+---------------------------------+
| EVIDENCE CHART (EvidenceChart)                   [▤ sim]      |
| per-source daily readings, threshold line, hatch for gaps,    |
| "▲ sources disagree" flags, table toggle, SR summary          |
| caption: "daily detail is display-only; contract stored the   |
|  aggregated value"                                            |
+--------------------------------------------------------------+
| CHECKS (CheckList)                                             |
| ✓ Threshold crossed — pass   ✓ Period covered — pass          |
| ? Location match — unclear   ✓ Data completeness — pass       |
| (empty reason shown when not yet evaluated / eval failed)     |
+----------------------------+---------------------------------+
| ACTIONS (right col)        | AUDIT (right col)                |
| [Request evaluation]       | criteria version, eval round,   |
| [Open dispute]             | reason code, contract address,  |
| [Settle claim]             | tx hash CopyField + explorer    |
| TxStatusPanel when in      |                                  |
| flight                     |                                  |
+----------------------------+---------------------------------+
| EVIDENCE (EvidenceTable, full width)                           |
| source | station | period | value | unit | evaluated flag     |
+--------------------------------------------------------------+
| Policy policy-3 (link) · policy data read live                |
```

Behavioural details the sketch encodes:

- **Buttons disabled with reasons** (UI.md §4.3/§6.2): Open dispute until
  decided; Settle until `finalized && amount > 0`, with the plain-language
  reason under the row ("nothing to settle" / "only once final"). Double
  submit prevented by `tx.phase !== "idle"` guard.
- **Write lifecycle** (`TxStatusPanel`, UI.md §6): submitted → pending →
  accepted → finalized / failed, with retry where valid. The
  `TxStatusStrip` inside DecisionPanel keeps Accepted vs Final permanently
  distinct.
- **Eval failure** (`claim.eval_error`): amber alert with mapped message +
  `Details` disclosure showing the stable `EXTERNAL: sources_unreachable`
  string. Claim 1 is the live example.
- **Chart empty state**: claims with no recorded daily series say so and point
  to the evidence table (which is the contract-evaluated record).
- Inconclusive claims render DecisionPanel with the `?` tone, a `resolve`
  sentence, and never an error style (UI.md §5.2).

**Missing vs UI.md §4.4:** no dedicated `DisputePanel` component — dispute
opening is a button in Actions and history lives inside `ClaimTimeline`
(`frontend/src/components/ClaimTimeline.tsx` §Dispute history). Functionally
present, component name differs.

---

## `/how-it-works` (`pages/HowItWorks.tsx`)

Sections: Leader and validators → What counts as the same answer (the four
equivalence rules) → Why "inconclusive" exists → Accepted is not final →
Historical simulation versus live → Limitations. Prose only, no diagram yet
(UI.md §4.6 welcomes one; none is drawn, so none can be mislabelled).

---

## Component ↔ UI.md map

| UI.md §5 | Built file | Notes |
|---|---|---|
| 5.1 EvidenceChart | `EvidenceChart.tsx` | shapes+labels, hatch gaps, conflict flags, table toggle, SR summary, empty state |
| 5.2 DecisionPanel | `DecisionPanel.tsx` | plain words, eval-error alert, terms list, finality strip |
| 5.3 CheckList | `CheckList.tsx` | required/optional tags, empty reasons |
| 5.4 ClaimTimeline | `ClaimTimeline.tsx` | numbered steps, dispute history, settlement line |
| 5.5 TxStatus | `TxStatusPanel.tsx` + `TxStatusStrip.tsx` | lifecycle panel + finality chip |
| 5.6 DataModeBadge | `DataModeBadge.tsx` | badge + explanatory panel |
| 5.7 SourceRegistryCard | `SourceRegistryCard.tsx` | **now rendered** on `/policies/:id` under "Eligible sources" (was dead code; the service layer's `list_sources` read feeds it) |
| 5.8 DisputePanel | — | **missing as a component**; Actions button + timeline history cover the function |
| 5.9 CopyField | `CopyField.tsx` | address/hash, copy, explorer link gated on config |

Plus one component UI.md doesn't name: `OriginBadge.tsx` — shows whether the
current screen is fed live chain data or the recorded snapshot, which
strengthens UI.md §0.5's honesty rule.

## Routes: spec vs built

| UI.md route | Status |
|---|---|
| `/` | built |
| `/demo` | built |
| `/policies` | built |
| `/policies/new` | **built** — form mirrors `create_policy`'s 18 schema params; live summary sentence; owner-only pre-warning via `get_owner`; new id resolved from a live `get_policy_count` read |
| `/policies/:id` | built; "Start a claim" action **now built** (`StartClaimPanel.tsx`) |
| `/claims/:id` | built |
| `/how-it-works` | built |
| `/claims` | added beyond spec (reviewer evidence table) |
