# UI.md — ClimateClaim Frontend Spec

> Audience: any coding agent building the ClimateClaim app.
> Read with: `AGENTS-ClimateClaim.md` (the build rules). If they conflict on GenLayer behavior, the official GenLayer docs win, then AGENTS, then this file.
> Scope: the frontend only. Contracts, equivalence design, and settlement rules live in AGENTS.

---

## 0. Ground Rules

1. **Never invent GenLayer client methods.** Verify every `genlayer-js` call (client creation, chain config, reads, writes, tx status, receipts) via Docs MCP or the SDK reference before using it. This file contains no client code on purpose.
2. **Inspect the deployed contract schema first** (`genlayer schema <address>`), save it, then wire the UI to it. Method names, argument types, and return shapes come from the schema, not from memory.
3. **Reads and writes look and behave differently.** Reads are instant views. Writes go through consensus and show a lifecycle.
4. **Never show an accepted result as permanent.** Finality is its own state.
5. **Never show a historical simulation as live.** Every claim surface carries a data-mode badge.
6. **`inconclusive` is a legitimate outcome, not an error.** Design it as a result with an explanation.
7. **The evidence the UI shows must be the evidence the contract evaluated** (same references). Anything the app fetched only for display is labeled display-only.
8. Secrets in env vars. `.env.example` present. No keys in the client bundle.

---

## 1. Users and Jobs

| User | Primary job | Success looks like |
|---|---|---|
| Policy holder | Define a weather condition and check whether it was met | Understands the decision and why, without reading contract code |
| Reviewer / judge | Verify the decision is auditable and GenLayer is actually needed | Sees evidence, criteria, per-check results, finality, and tx links in under a minute |
| Disputing party | Challenge a decision | Knows what can be disputed, what happens next, and the dispute history |

The first-time reviewer is the hardest audience. The **demo mode** (section 8) exists for them.

---

## 2. Design Direction

**Subject:** parametric weather claims. The vernacular is the field station, the rain gauge, the observation log, the isobar chart, the threshold line. Design from that, not from generic fintech or crypto dashboards.

**One memorable element:** the **Evidence Chart** (section 5.1). Observations from each source plotted against the policy threshold, with gaps drawn as visible hatched spans and conflicts drawn as visible disagreement. Everything else stays quiet.

### 2.1 Palette (named tokens; tune, don't dilute)

| Token | Hex | Role |
|---|---|---|
| `--gauge-paper` | `#EDF1F3` | Page background (cool, slightly blue-grey) |
| `--rain-slate` | `#26323D` | Primary text, headings |
| `--isobar` | `#2E6C97` | Primary action, links, focus ring base |
| `--threshold-ink` | `#B4432B` | **Only** the threshold line and "threshold crossed" marks. Do not reuse elsewhere. |
| `--lichen` | `#3F7A57` | Confirmed |
| `--amber-flag` | `#B97A12` | Inconclusive, missing, conflicting |
| `--hail` | `#C7D3DB` | Borders, dividers, empty chart grid |
| `--surface` | `#FFFFFF` | Raised surfaces used sparingly |

Dark theme is optional. If built, derive tokens deliberately; do not invert.
Meet WCAG AA contrast for all text and for the status colors against their backgrounds. **Never rely on color alone**: every status also has an icon and a text label.

Avoid the generic defaults: cream + terracotta, near-black + acid green, identical rounded cards with the same soft shadow, gradient washes.

### 2.2 Type

- **UI and body:** Atkinson Hyperlegible Next (designed for legibility; suits dense data).
- **Headlines and policy text:** Literata (a readable serif; policy wording reads as a document).
- Numerals in data: tabular figures on (`font-variant-numeric: tabular-nums`).
- Sentence case everywhere. No ALL-CAPS labels. No tracked-out eyebrows above every heading.
- Line length under 80 characters for prose.
- If substituting fonts, say what you changed and why. Self-host or use a verified font host; do not break the CSP of the deploy target.

Type scale (suggestion): 14 / 16 / 18 / 22 / 28 / 40. Body 16. Headline line-height tighter than body; serif body slightly looser than sans.

### 2.3 Shape and structure

- Radii: small for inputs and chips, none for the chart, medium for panels. Hierarchy, not one radius everywhere.
- Borders and dividers encode structure (grouping evidence by source, separating claim stages). No decorative rules.
- Numbered markers **only** for the claim timeline, because that content really is a sequence.
- Motion: only in response to user action (expanding evidence, status change confirmation). One optional orchestrated moment on the Evidence Chart first render (readings draw in, threshold line settles). Respect `prefers-reduced-motion`.

---

## 3. Information Architecture

```
/                      Landing: what it does, why GenLayer, link to demo
/demo                  Demo mode: preloaded historical scenarios
/policies              List of policies (mine / all, filter by data mode)
/policies/new          Create policy
/policies/:id          Policy detail + claims on it
/claims/:id            Claim detail (the main screen)
/how-it-works          Consensus, equivalence, finality, limitations
```

Persistent chrome: network indicator, wallet/account state, data-mode legend. Footer links: README, contract addresses, explorer.

---

## 4. Screens

### 4.1 Landing `/`
Job: say what ClimateClaim is and show it working.
- One-sentence pitch in plain language.
- A live, small Evidence Chart from a demo scenario (not a stock illustration).
- Two actions: "Open the demo" and "Create a policy".
- Short "Why GenLayer" panel: sources can be incomplete or disagree, and policy wording needs interpretation.

### 4.2 Create policy `/policies/new`
Fields map to the schema. Validate client-side to mirror contract validation, but the contract is the authority.
- Location (name and/or coordinates, with a clear note on how a "match" is judged)
- Observation period (start, end, timezone shown explicitly)
- Metric and unit
- Threshold (comparator + value + unit)
- Aggregation rule (explained in plain words next to each option)
- Eligible sources (choose from the source registry; show what each provides)
- Data mode: **Historical simulation** or **Live** (required; explain the difference inline)
- Payout terms (only if settlement is built)

Show a plain-language **policy summary sentence** that updates as the form changes, e.g. "Confirmed if the daily rainfall total at [location] exceeds [value] [unit] on any day between [start] and [end], using [sources]." The user confirms the sentence, not just the fields.

Submit is a **write**: show the lifecycle (section 6). After finality-independent acceptance, route to the policy page with its pending/accepted state visible.

### 4.3 Policy detail `/policies/:id`
- Policy summary sentence, terms table, data-mode badge, sources used.
- Claims on this policy with state and decision chips.
- Action: "Start a claim" (disabled with a reason when the policy is retired or the period isn't open).
- Immutability note once any claim references the policy.

### 4.4 Claim detail `/claims/:id` (the main screen)

```
+--------------------------------------------------------------+
| Claim #id   [Historical simulation]   [Network]              |
| Policy summary sentence                                      |
+----------------------------+---------------------------------+
| DECISION                   | CLAIM TIMELINE                  |
| Confirmed / Not confirmed  | 1 Created                       |
| / Inconclusive             | 2 Evidence collected            |
| Reason in plain language   | 3 Evaluated (round n)           |
| Finality: accepted|final   | 4 Disputed? (history)           |
|                            | 5 Settled? (if built)           |
+----------------------------+---------------------------------+
| EVIDENCE CHART  (readings per source vs threshold line)      |
|  gaps = hatched, conflicts = visible disagreement            |
+--------------------------------------------------------------+
| CHECKS   threshold crossed | period covered | location match |
|          source agreement  | data completeness               |
|          each: pass / fail / unclear + one-line explanation  |
+--------------------------------------------------------------+
| EVIDENCE TABLE  source, station/location, period, values,    |
|  units, retrieval reference, [evaluated | display-only]      |
+--------------------------------------------------------------+
| AUDIT  criteria version, evaluation round, reason code,      |
|  tx hash + explorer link, receipt status                     |
+--------------------------------------------------------------+
| ACTIONS  Request evaluation | Dispute | Settle (when allowed)|
+--------------------------------------------------------------+
```

Left-align content. Decision block is the first thing read; the chart is the most distinctive thing seen.

### 4.5 Demo `/demo`
See section 8.

### 4.6 How it works `/how-it-works`
Plain-language explanation of: leader proposes, validators evaluate independently, equivalence (what counts as the same conclusion), appeals and finality, why `inconclusive` exists, and an honest limitations list (data-source trust, historical vs live). A diagram is welcome; label it accurately and don't overclaim.

---

## 5. Key Components

### 5.1 EvidenceChart
- X axis: observation period in the policy timezone. Y axis: metric with unit.
- Per-source series, distinguishable by **shape and label**, not color alone.
- **Threshold line** in `--threshold-ink`, labeled with value + unit + comparator.
- **Missing observations:** hatched span with a label ("No reading from [source]").
- **Conflicts:** when sources disagree about a crossing, show both and flag the disagreement.
- Out-of-period or discarded readings: shown muted with a "not counted" note, or omitted with a count.
- Hover/focus tooltip: source, timestamp, value, unit. Keyboard accessible.
- Accessible alternative: a data table view toggle, plus a text summary ("Source A crossed the threshold on 3 days; Source B on 1 day").
- Must render correctly with zero, one, and many sources, and with empty data.

### 5.2 DecisionPanel
- Decision label in plain words: "Condition confirmed", "Condition not confirmed", "Inconclusive".
- One-to-two sentence reason derived from `reason_code` (map enum to copy; don't show raw enums).
- Finality chip beside it (section 6.3).
- For `inconclusive`: say what was missing or conflicting, and what could resolve it (e.g. retry later, dispute with new evidence). Never styled as an error state.

### 5.3 CheckList
One row per check: icon + name + status text + short explanation. Statuses: pass, fail, unclear. Required vs. optional checks are indicated.

### 5.4 ClaimTimeline
Sequence component, so numbering is appropriate. Shows the current state-machine position, past transitions with timestamps and tx links, and disabled future steps.

### 5.5 TxStatus
The write lifecycle component (section 6). Reused by every write action.

### 5.6 DataModeBadge
Two variants: **Historical simulation** and **Live**. Always visible on policy and claim surfaces. Different shape/icon + label, not color alone. Tooltip explains the difference.

### 5.7 SourceRegistryCard
Name, what it provides, units, update cadence, known quirks, and a link to its documentation. Pulled from the same registry the contract side documents (`docs/sources.md`).

### 5.8 DisputePanel
Opens a dispute (if allowed), shows grounds field with limits, shows the rounds history (each round's decision, who disputed, when), and explains how disputes relate to GenLayer's own appeal process in plain words (verify the actual mechanics in the docs; don't paraphrase from guesswork).

### 5.9 CopyField
Addresses and hashes: truncated display, full value on focus/hover, copy button with confirmation, explorer link.

---

## 6. Transaction Lifecycle (writes)

### 6.1 States
`idle -> submitted -> pending -> accepted -> finalized`, with `failed` reachable from submitted/pending/accepted paths as the docs define.

| State | Meaning (user words) | UI |
|---|---|---|
| idle | Nothing sent | Normal action button |
| submitted | Sent to the network | Disabled button, spinner, tx hash once known |
| pending | Validators are evaluating | Progress indicator, "This can take a while", refresh control |
| accepted | Validators agreed; it can still be appealed | Result shown with "Not final yet" chip |
| finalized | Permanent | Result shown with "Final" chip |
| failed | Did not complete | Mapped error message + retry where valid |

Verify exact status names and how the SDK reports them before mapping; the table above is the UI vocabulary, not the SDK's.

### 6.2 Behavior
- Show the tx hash as soon as available, with copy + explorer link. Never invent a link; build it from verified explorer config.
- Poll or subscribe for status using the verified SDK mechanism. Stop polling at a terminal state. Provide manual refresh.
- Optimistic UI is limited to the "submitted" state. Do not show results before acceptance.
- Prevent double submission (disable action while in flight; guard against double clicks and re-renders).
- Persist in-flight tx hashes (e.g. in local state/storage) so a reload can resume tracking.

### 6.3 Finality chip
Two visible levels on every decision: **Accepted (can still be appealed)** and **Final**. Settlement actions are enabled only at Final (when settlement exists).

### 6.4 Reads
Instant. Show skeleton/loading, then data, or an error with retry. Reads never display the write lifecycle.

---

## 7. Error and Empty States

### 7.1 Error mapping (prefix to message)

| Contract prefix | User message | Action |
|---|---|---|
| `EXPECTED` | Specific, human reason (not owner, claim outside the period, policy retired) | Fix input |
| `EXTERNAL` | "A data source couldn't be reached. Try again later." | Retry |
| `TRANSIENT` | "Temporary problem. Try again." | Retry button |
| `LLM_ERROR` | "The evaluation couldn't be completed. Try again." | Retry |

Rules: errors say what happened and what to do. No apologies, no vague "Something went wrong". Never show raw model output or raw stack traces; offer a "Details" disclosure for the stable error string and tx hash.

### 7.2 Environment states
- Wrong network: blocking banner with a clear switch action.
- No wallet/account: explain what's needed; reads still work where possible.
- Unfunded account on a funded network: explain and link the faucet (browser-based claim).
- StudioNet showing 0 GEN: expected; do not warn.
- Contract unreachable / wrong address: config error screen naming the address and network.

### 7.3 Empty states
Every list has one, and it invites an action ("No claims yet. Start a claim on this policy.").

---

## 8. Demo Mode

A reviewer must see every interesting outcome without waiting on live data.

- Preloaded **historical simulation** scenarios, clearly labeled, backed by `fixtures/historical/`:
  1. Threshold clearly crossed (confirmed)
  2. Threshold clearly not reached (not confirmed)
  3. Exactly at the threshold (boundary behavior)
  4. Conflicting sources (inconclusive)
  5. Missing observations (inconclusive)
  6. Location mismatch
  7. Repeated claim attempt (rejection / retry rule)
  8. Dispute and re-evaluation round
- Each scenario: a short "what this tests" sentence, the Evidence Chart, the decision and checks.
- Scenarios are runnable against the deployed contract where possible (real tx, real receipts), or clearly marked "replay of a recorded result" when not. Never fake a transaction.
- A visible toggle between "Replay recorded result" and "Run on network" if both exist.

---

## 9. Architecture

- Stack: React + TypeScript (per the boilerplate; adapt to it rather than replacing it). Verify the boilerplate's conventions first.
- One module creates the GenLayer client from typed config. No client creation scattered through components.
- One typed config file holds: network/chain config, contract addresses, explorer URL patterns, schema-derived method names. No scattered literals.
- Contract access goes through a thin typed service layer (`services/`) that wraps verified SDK calls and maps results to UI types. Components never call the SDK directly.
- Map contract enums (`decision`, `reason_code`, check statuses, claim states) to UI copy in one place.
- Server state (reads) via a caching layer (e.g. a query library) with sensible refetch; write state via the TxStatus lifecycle.
- Suggested layout:

```
frontend/
  src/
    config/        network.ts, contracts.ts, explorer.ts
    services/      policyService, claimService, evaluationService  (wrap verified SDK calls)
    domain/        types.ts, enums.ts, copy.ts  (enum -> plain-language copy)
    components/    EvidenceChart, DecisionPanel, CheckList, ClaimTimeline,
                   TxStatus, DataModeBadge, SourceRegistryCard, DisputePanel, CopyField
    pages/         Landing, Demo, Policies, PolicyNew, PolicyDetail, ClaimDetail, HowItWorks
    fixtures/      demo scenarios (typed)
    tests/
```

---

## 10. Accessibility and Quality Floor

- Keyboard: every action reachable; visible focus ring (`--isobar` based, 3:1 against adjacent colors).
- Screen readers: landmarks, headings in order, status changes announced (live region for tx state), chart has a table alternative and text summary.
- Color is never the only signal.
- Touch targets at least 44px on mobile.
- Responsive: usable at 360px width. The chart reflows (shorter aspect, horizontal scroll inside its own container if needed; the page body never scrolls sideways).
- `prefers-reduced-motion` respected.
- No layout shift on tx state changes (reserve space for status chips).
- Dates/times: always show timezone; policy period uses the policy's timezone.

---

## 11. Copy Rules

- Write for the policy holder, not the protocol. "Condition confirmed", not "consensus reached on boolean true".
- Sentence case, active voice, plain verbs. Buttons say what happens: "Request evaluation", "Open dispute", "Settle claim".
- One name per action across the whole flow (button, toast, and status use the same verb).
- Explain GenLayer terms once, in place, where they appear (finality, appeal, validator), with a link to How it works.
- Never claim certainty the system doesn't have: "Accepted" is not "Final"; "Confirmed" means the evidence met the policy's terms, not that a legal claim is payable.

---

## 12. Testing the UI

- Component tests for each component across all its states (including empty and error).
- Chart tests: zero/one/many sources, gaps, conflicts, boundary values, out-of-period data.
- Tx lifecycle tests with a mocked service layer: every transition, double-submit prevention, reload resume, failure paths.
- Error-mapping tests: each prefix maps to the right message and action.
- Data-mode badge present on every policy and claim view (test it).
- Accessibility checks (automated + manual keyboard pass).
- One end-to-end path against StudioNet (or the target network) with real receipts, recorded for the evidence pack.

---

## 13. UI Milestones and Acceptance

| Milestone | Acceptance criteria |
|---|---|
| UI-1 Config and client | Schema saved; typed config; single client module; read call renders real data |
| UI-2 Policy flow | Create policy writes through full lifecycle; summary sentence; validation |
| UI-3 Claim page | Decision, checks, timeline, audit block render from real contract data |
| UI-4 Evidence chart | All chart states handled; table alternative; accessible |
| UI-5 Tx and finality | All states shown; accepted vs final distinct; explorer links verified |
| UI-6 Dispute (+ settlement if built) | Dispute history shown; settle only at Final; double-settle impossible from UI |
| UI-7 Demo mode | Eight scenarios; honest labeling of replay vs live run |
| UI-8 Polish and evidence | A11y pass, responsive, screenshots, recording, README section |

Each milestone closes only with evidence (screenshots, test output, tx links). Never invent hashes, addresses, or explorer links.

---

## 14. Definition of Done (UI)

- [ ] Schema inspected and saved before wiring
- [ ] Every SDK call verified in docs; none guessed
- [ ] Reads and writes visibly different
- [ ] Accepted vs finalized never conflated
- [ ] Data-mode badge on every policy/claim surface
- [ ] `inconclusive` presented as a result with an explanation
- [ ] Evidence shown equals evidence evaluated; display-only data labeled
- [ ] Error prefixes mapped to actionable messages
- [ ] Wrong-network, no-wallet, unfunded-account, bad-config states handled
- [ ] Demo mode with eight scenarios, honestly labeled
- [ ] Keyboard, screen-reader, contrast, reduced-motion checks pass
- [ ] Responsive at 360px
- [ ] Typed config; no scattered literals; no secrets in the bundle
- [ ] README has a UI section with screenshots and run steps
- [ ] Evidence pack: recording + real tx links

---

When in doubt: verify the API, show the real state, label the data honestly.
