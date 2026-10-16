/**
 * English strings — the SOURCE OF TRUTH for the whole catalogue.
 *
 * `MessageKey` is derived from this object, and every other locale is typed as
 * `Record<MessageKey, string>`. Adding a key here therefore makes `es`, `fr`
 * and `de` fail to COMPILE until they are updated. That is deliberate: it is the
 * only reliable way to guarantee no screen is ever half-translated.
 *
 * Placeholders use `{name}` and are substituted by `t(key, vars)`. A placeholder
 * is never concatenated into the string, because word order differs between
 * these four languages and German and Spanish routinely place the object after
 * the verb.
 */

export const en = {
  // --- generic -------------------------------------------------------------
  "common.yes": "yes",
  "common.no": "no",
  "common.details": "Details",
  "common.loading": "Loading",
  "common.retry": "Try again",
  "common.chain": "chain {id}",
  "common.optional": "optional",
  "common.dash": "—",
  "common.unknown": "Unknown",
  "common.notEvaluated": "not evaluated",

  // --- navigation / chrome -------------------------------------------------
  "nav.main": "Main",
  "nav.home": "Home",
  "nav.demo": "Demo",
  "nav.claims": "Claims",
  "nav.policies": "Policies",
  "nav.howItWorks": "How it works",
  "nav.skipToMain": "Skip to main content",
  "nav.notFound.h": "Page not found",
  "flow.leader": "Leader fetches the eligible sources and proposes a result",
  "flow.validators": "Validators fetch the same sources and evaluate independently",
  "flow.equivalent": "Are the results equivalent?",
  "flow.accepted": "Accepted — still appealable",
  "flow.rejected": "Proposal rejected",
  "flow.appealed": "Appealed?",
  "flow.finalised": "Finalised",
  "flow.settled": "Settled — paid once",
  "flow.yes": "yes",
  "flow.no": "no",
  "flow.arrowTo": "then",
  "flow.caption":
    "How a decision is reached: a leader proposes, validators evaluate independently, the result is kept only if they agree it means the same thing, and only a final decision can settle.",
  "nav.notFound.body": "That address does not match a page in this app.",
  "nav.wrongNetwork": "Wrong network ({id})",
  "footer.tagline": "Evidence-based parametric weather claims on GenLayer.",
  "footer.contract": "Contract {address}",
  "footer.explorer": "Explorer",
  "footer.explorerPaused": "Explorer currently paused",
  "footer.demoMode": "Demo mode",

  // --- theme ---------------------------------------------------------------
  "theme.label": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.useSystem": "Use the system theme",
  "theme.useLight": "Use the light theme",
  "theme.useDark": "Use the dark theme",

  // --- language ------------------------------------------------------------
  "lang.label": "Language",
  "lang.change": "Change language",

  // --- decisions -----------------------------------------------------------
  "decision.eyebrow": "Decision",
  "decision.confirmed.label": "Condition confirmed",
  "decision.confirmed.sentence": "The recorded evidence met the terms of this policy.",
  "decision.notConfirmed.label": "Condition not confirmed",
  "decision.notConfirmed.sentence": "The recorded evidence did not meet the terms of this policy.",
  "decision.inconclusive.label": "Inconclusive",
  "decision.inconclusive.sentence":
    "The evidence does not settle the question either way. This is a result, not an error.",
  "decision.none.label": "Not evaluated yet",
  "decision.none.sentence": "This claim has no decision yet.",
  "decision.validatorWords": "In the validator's words:",
  "decision.evalFailed": "This evaluation did not complete",
  "decision.errorDetail": "The stable contract error string is {code}. Retrying usually works when the source was temporarily unavailable.",
  "decision.claimState": "Claim state",
  "decision.highestReading": "Highest reading",
  "decision.threshold": "Threshold",
  "decision.period": "Observation period",
  "decision.round": "Evaluation round",

  // --- reason codes --------------------------------------------------------
  "reason.thresholdCrossed": "At least one reading in the observation period met the policy's threshold.",
  "reason.thresholdNotCrossed": "No reading in the observation period met the policy's threshold.",
  "reason.sourceConflict":
    "The eligible sources disagreed about whether the threshold was crossed, and the policy does not define a tie-break.",
  "reason.sourceConflict.resolve":
    "Dispute the decision with a reason if you believe one source should take precedence.",
  "reason.missingObservations":
    "The evidence does not cover the whole observation period, so the threshold cannot be judged.",
  "reason.missingObservations.resolve":
    "Retry the evaluation later, or dispute with a source that does cover the period.",
  "reason.locationMismatch":
    "The reported station is outside the distance this policy allows from the stated location.",
  "reason.locationMismatch.resolve": "Dispute if you believe the station is in fact the right location.",
  "reason.sourcesUnreachable":
    "None of the eligible sources could be reached, so there was nothing to evaluate.",
  "reason.sourcesUnreachable.resolve": "Retry the evaluation - this one is usually temporary.",
  "reason.none": "No reason has been recorded yet.",

  // --- checks --------------------------------------------------------------
  "check.thresholdCrossed.label": "Threshold crossed",
  "check.thresholdCrossed.blurb": "Whether a reading met the policy threshold.",
  "check.periodCovered.label": "Period covered",
  "check.periodCovered.blurb": "Whether the evidence spans the whole observation period.",
  "check.locationMatch.label": "Location match",
  "check.locationMatch.blurb": "Whether the reported station matches the policy location.",
  "check.sourceAgreement.label": "Source agreement",
  "check.sourceAgreement.blurb": "Whether the eligible sources agreed with each other.",
  "check.dataCompleteness.label": "Data completeness",
  "check.dataCompleteness.blurb": "Whether any observation is missing from the period.",
  "check.status.pass": "Passed",
  "check.status.fail": "Failed",
  "check.status.unclear": "Unclear",
  "check.required": "required",
  "check.supporting": "supporting",
  "check.none": "No checks were recorded for this claim.",

  // --- claim states --------------------------------------------------------
  "state.created.label": "Created",
  "state.created.blurb": "The claim exists. Evidence has not been requested yet.",
  "state.pendingEvaluation.label": "Evaluating",
  "state.pendingEvaluation.blurb": "Validators are fetching the evidence and comparing results.",
  "state.evidenceCollected.label": "Evidence collected",
  "state.evidenceCollected.blurb":
    "The observations were retrieved. No decision has been reached yet.",
  "state.decidedConfirmed.label": "Decision: confirmed",
  "state.decidedConfirmed.blurb": "A decision has been reached and accepted by validators.",
  "state.decidedNotConfirmed.label": "Decision: not confirmed",
  "state.decidedNotConfirmed.blurb": "A decision has been reached and accepted by validators.",
  "state.inconclusive.label": "Decision: inconclusive",
  "state.inconclusive.blurb":
    "A decision has been reached: the evidence does not settle the question.",
  "state.disputed.label": "Disputed",
  "state.disputed.blurb": "The decision is being challenged and will be re-evaluated.",
  "state.settled.label": "Settled",
  "state.settled.blurb": "The payout for this claim has been made.",
  "state.unknown.label": "Unknown",
  "state.unknown.blurb": "This state is not recognised.",

  // --- settlement ----------------------------------------------------------
  "settlement.notSettled": "Not settled",
  "settlement.payoutEmitted": "Payout emitted - delivery not yet verified",
  "settlement.settled": "Settled",
  "settlement.failed": "Payout failed - retryable",
  "settlement.unknown": "Unknown",

  // --- data mode -----------------------------------------------------------
  "datamode.live.label": "Live",
  "datamode.live.blurb":
    "Values are fetched from the source at evaluation time. The result reflects the world now, and can change if you re-evaluate.",
  "datamode.historical.label": "Historical simulation",
  "datamode.historical.blurb":
    "Values come from archived observations for a window that is entirely in the past - not a live feed. The contract re-fetches the archive each time a claim is evaluated, so a provider revising its own history would be reflected: this is not a frozen dataset.",
  "datamode.recorded": "· recorded",
  "datamode.mixed": "· mixed",
  "datamode.recordedTitle": "Read from a captured snapshot, not the live chain.",
  "datamode.mixedTitle": "Some of this was read live; some came from the captured snapshot.",

  // --- origin (where the on-screen data came from) -------------------------
  "origin.live": "Live from {network}",
  "origin.liveTitle": "Read live from {network}.",
  "origin.mixed": "Mixed live & recorded",
  "origin.mixedTitle":
    "Some of this was read live from {network}; some came from the snapshot captured {captured}.",
  "origin.checking": "Recorded snapshot · checking {network}",
  "origin.checkingTitle":
    "Showing the snapshot captured {captured} while the live read completes.",
  "origin.recorded": "Recorded snapshot",
  "origin.recordedTitle": "Recorded on-chain snapshot captured {captured}.",
  "origin.recordedUnreachable": " (network unreachable)",
  "origin.unreachable": " The network could not be reached ({error}).",
  "origin.networkDefault": "the network",

  // --- transaction phases --------------------------------------------------
  "tx.idle": "Not sent yet",
  "tx.submitted": "Sent to the network",
  "tx.pending": "Validators are evaluating",
  "tx.accepted": "Accepted — can still be appealed",
  "tx.finalized": "Final",
  "tx.failed": "Did not complete",
  "tx.hint.submitted": "Waiting for the network to pick it up.",
  "tx.hint.pending": "This can take a while. Validators fetch the sources independently.",
  "tx.hint.accepted": "Validators agreed. The result is not permanent until it is final.",
  "tx.hint.finalized": "This result is permanent.",
  "tx.hint.failed": "Nothing changed on chain.",
  "tx.refresh": "Refresh status",
  "tx.final.final": "Final",
  "tx.final.accepted": "Accepted — can still be appealed",
  "tx.final.notYet": "Not final yet",

  // --- errors --------------------------------------------------------------
  "error.empty": "Something did not complete.",
  "error.expected": "That request is not allowed.",
  "error.external": "A data source could not be reached, so there was nothing to evaluate.",
  "error.transient": "There was a temporary problem on the network.",
  "error.llm": "The evaluation could not be completed.",
  "error.generic": "That action could not be completed.",

  // --- policy terms --------------------------------------------------------
  "agg.maxSingle": "highest single reading on any day",
  "agg.cumulative": "total across the whole period",
  "agg.consecutiveDays": "longest run of consecutive days",
  "cmp.gt": "more than",
  "cmp.gte": "at least",
  "cmp.lt": "less than",
  "cmp.lte": "at most",
  "policy.sentence":
    "Confirmed if the {aggregation} at {location} is {comparator} {threshold} {unit} on any day between {start} and {end}, using {sources}.",
  "policy.sources.none": "no sources",
  "policy.sources.two": "{first} and {last}",

  // --- shared components ---------------------------------------------------
  "copy.copy": "Copy",
  "copy.copied": "Copied",
  "copy.viewOnExplorer": "View on explorer",
  "copy.explorerUnavailable": "Explorer link unavailable",
  "copy.explorerNoteDefault": "The explorer is not currently serving.",
  "evidence.chart": "Evidence chart",
  "evidence.showTable": "Show as table",
  "evidence.showChart": "Show chart",
  // Summary sentence. Split into singular/plural variants because the four
  // locales pluralise differently and a naive `{days} days` is wrong in most of
  // them; these are chosen in code rather than by concatenating a suffix.
  "evidence.summaryCrossedOne": "{label} crossed the threshold on {days} day",
  "evidence.summaryCrossedMany": "{label} crossed the threshold on {days} days",
  "evidence.summaryMissingOne": "{days} reading is missing and not estimated.",
  "evidence.summaryMissingMany": "{days} readings are missing and not estimated.",
  "evidence.summaryConflictOne": "The sources disagree about crossing on {days} day.",
  "evidence.summaryConflictMany": "The sources disagree about crossing on {days} days.",
  "evidence.captionTable":
    "Readings per source, in {unit}, against a threshold of {comparator} {threshold} {unit}.",
  "evidence.noData": "There is no evidence to plot for this claim yet.",
  "evidence.gapLabel": "missing",
  "evidence.legend.disagree": "sources disagree",
  "evidence.col.date": "Date",
  "evidence.col.note": "Note",
  "evidenceTable.col.source": "Source",
  "evidenceTable.col.station": "Station reported",
  "evidenceTable.col.period": "Period",
  "evidenceTable.col.unit": "Unit",
  "evidenceTable.col.days": "Days",
  "evidenceTable.col.crossed": "Crossed",
  "evidenceTable.col.status": "Status",
  "source.identifier": "Identifier",
  "source.variable": "Variable",
  "source.unit": "Unit",
  "source.attribution": "Attribution",
  "source.quirks": "Known quirks",
  "source.exampleRequest": "Example request",
  "startClaim.heading": "Start a claim",
  "startClaim.periodStart": "Claim period start",
  "startClaim.periodEnd": "Claim period end",
  "startClaim.retired": "This policy is retired, so no new claims can be started on it.",
  "wallet.heading": "Wallet",
  "wallet.detected": "Detected wallets",
  "wallet.account": "Account",
  "wallet.chooseFirst": "Choose a wallet above first.",
  "wallet.closePanel": "Close wallet panel",
  "wallet.eip6963Title":
    "Found via window.ethereum; this wallet does not implement EIP-6963.",
  "evidence.caption.claimDetail":
    "Daily readings come from the recorded source response for this location and period (see fixtures/historical/). The contract stores the aggregated value and the crossing flag; the daily detail is display-only.",
  "evidence.caption.demo":
    "Readings are the recorded response from the documented endpoint for this location and period. Missing days are drawn as hatched gaps and are never estimated.",
  "evidence.noSeries":
    "No recorded daily series backs this claim yet. The aggregated evidence the contract evaluated is in the evidence table below.",
  "audit.heading": "Audit",
  "audit.export": "Export receipt (JSON)",
  "audit.exportHint":
    "Download the full audit record — policy, evidence, checks, decision, disputes and settlement — as a JSON file.",
  "audit.criteriaVersion": "Criteria version",
  "audit.round": "Evaluation round",
  "audit.reasonCode": "Reason code",
  "audit.finalized": "Finalized",
  "audit.finalizedYes": "yes",
  "audit.finalizedNo": "no — an accepted decision can still be appealed",
  "audit.claimId": "Claim ID",
  "audit.policyId": "Policy ID",
  "audit.contract": "Contract",
  "audit.network": "Network",
  "audit.transaction": "Transaction",
  "audit.contractAddress": "Contract address",
  "audit.txHash": "Transaction hash",
  "audit.explorerDown": "Explorer links are unavailable right now",
  "audit.meaningTitle": "What “confirmed” does and does not mean",
  "audit.meaning":
    "“Confirmed” means the evidence the validators retrieved met the terms this policy defined. It is not a legal determination and it is not a statement that anyone is contractually obliged to pay. A payout only happens once the decision is final, and only through the settlement path.",
  "timeline.heading": "Progress",
  "timeline.claim": "Claim timeline",
  "timeline.disputes": "Dispute history",
  "timeline.caption":
    "Each round keeps the decision it replaced and the grounds that challenged it.",
  "timeline.col.round": "Round",
  "timeline.col.grounds": "Grounds",
  "timeline.col.before": "Decision before",
  "timeline.col.after": "Decision after",
  "policies.ownerOnlyNote": "Owner-only: the contract registers policies from its owner.",
  "policies.noRegistryMatch": "No registry entries matched this policy's sources.",
  "policies.noClaimsYet": "No claims yet on this policy.",

  // --- wallet --------------------------------------------------------------
  "wallet.connect": "Connect wallet",
  "wallet.connected": "Connected",
  "wallet.disconnect": "Disconnect",
  "wallet.copyAddress": "Copy address",
  "wallet.switchNetwork": "Switch network",
  "wallet.noneFound": "No injected wallet found",
  "wallet.noneFoundBody":
    "A web page cannot list installed browser extensions — it can only see wallets that announce themselves. Install or unlock a wallet extension (MetaMask, Rabby, Brave and others) and reload.",
  "wallet.multiFound": "More than one wallet is installed. Pick which one this app talks to — without EIP-6963, whichever loaded last would silently win.",
  "wallet.onUnknownNetwork": "Connect your wallet to {network} to continue.",

  // --- landing -------------------------------------------------------------
  "landing.h1": "Did the weather actually do that?",
  "landing.lede":
    "ClimateClaim checks recorded weather observations against a policy you write in plain language, and shows you the readings that produced the answer. When the evidence is incomplete or the sources disagree, it says so instead of guessing.",
  "landing.openDemo": "Open the demo",
  "landing.seeConflict": "See the source conflict",
  "landing.seeClaims": "See real claims",
  "landing.disagreement.h": "A real disagreement",
  "landing.disagreement.p":
    "Two independent reanalyses of the same place, same day. One says 1.10 mm, the other says 2.03 mm. Against a 1.50 mm threshold, one crosses and one does not. The honest answer is inconclusive, and that is a result rather than an error.",
  "landing.whyGenLayer.h": "Why GenLayer",
  "landing.whyGenLayer.p1":
    "Weather evidence is not clean. A source can be down, can return only part of the period, and two equally reputable reanalyses can disagree by a factor of two. A policy also needs interpreting: which station counts as “the area”, whether a day at exactly the threshold counts, what to do when two sources disagree.",
  "landing.whyGenLayer.p2":
    "Validators here independently fetch the same sources and compare meaning, not bytes. Where the evidence genuinely does not settle the question, the contract returns inconclusive instead of forcing a yes or no.",
  "landing.whyGenLayer.link": "How consensus, equivalence and finality work",
  "landing.wont.h": "What it will not do",
  "landing.wont.l1": "Invent, interpolate or estimate a missing reading.",
  "landing.wont.l2":
    "Let a language model do the threshold arithmetic — that is plain integer code.",
  "landing.wont.l3": "Pick the friendlier source to make a claim pass.",
  "landing.wont.l4": "Settle a payout on a decision that is merely accepted.",
  "landing.wont.l5": "Present recorded historical data as if it were live.",
  "landing.deployed": "Deployed at {address} on {network} (chain {id}). {scaled} thresholds and amounts are stored as scaled integers, never floats.",

  // --- hero evidence field (three.js) --------------------------------------
  "hero.threshold": "threshold {value} {unit}",
  "hero.drag": "drag to rotate",
  "hero.split": "{day}: sources disagree · drag to rotate",

  // --- how it works --------------------------------------------------------
  "how.h1": "How a decision is reached",
  "how.lede":
    "One leader proposes a result, several validators check it independently, and the result is only kept if enough of them agree it means the same thing.",
  "how.leader.h": "Leader and validators",
  "how.leader.p1":
    "For an evaluation, one leader fetches the eligible sources and produces a structured result: a decision, a reason, five per-check statuses and an observed value. That proposal is not taken on trust. Each validator fetches the same sources itself, evaluates them under the policy's rules, and produces its own result.",
  "how.leader.p2":
    "The result is kept when the validators’ conclusions are equivalent — that is, when they mean the same thing, even if their wording differs. A validator whose own result disagrees rejects the proposal rather than deferring to it.",
  "how.equiv.h": "What counts as the same answer",
  "how.equiv.p1": "Weather text is not compared byte for byte. Two results are treated as equivalent when:",
  "how.equiv.l1": "the decision matches exactly;",
  "how.equiv.l2": "the reason is the same, or within a documented equivalence group;",
  "how.equiv.l3":
    "every required check — threshold crossed, period covered, data complete — matches;",
  "how.equiv.l4":
    "the observed value is within a documented tolerance and sits on the same side of the threshold as the decision.",
  "how.equiv.p2":
    "That last condition is a deliberate guard. A validator will not accept a confirmed whose own numbers fail the threshold, so validators cannot agree on something that is simply wrong. Units and timezones are normalised before any comparison, and threshold arithmetic is plain integer code — never the language model’s job.",
  "how.inconclusive.h": "Why “inconclusive” exists",
  "how.inconclusive.p1":
    "When the evidence does not settle the question, the honest answer is that it does not settle the question. ClimateClaim returns inconclusive for four distinct situations:",
  "how.inconclusive.l1t": "Source conflict",
  "how.inconclusive.l1d":
    "two sources disagree about crossing, and the policy defines no tie-break.",
  "how.inconclusive.l2t": "Missing observations",
  "how.inconclusive.l2d":
    "the period is not fully covered. The gap is reported, never filled in.",
  "how.inconclusive.l3t": "Location mismatch",
  "how.inconclusive.l3d":
    "the reported station is further from the policy point than the policy’s own tolerance allows.",
  "how.inconclusive.l4t": "Sources unreachable",
  "how.inconclusive.l4d": "nothing could be retrieved, so there was nothing to evaluate.",
  "how.inconclusive.p2":
    "This is a result, not an error. It is also the clearest argument for GenLayer: a single deterministic chain reading one API would have to either pass or fail the claim, and would have no honest way to express the gap.",
  "how.finality.h": "Accepted is not final",
  "how.finality.p1":
    "When validators agree, the result is accepted. It can still be appealed. Only after the network finalises it does it become final, and only then can a payout happen. This app shows those two states separately at every level, and the settle button stays disabled until the contract itself reports the decision as final.",
  "how.finality.p2":
    "A settled claim can only be settled once. The contract records a settlement state and checks it before any transfer, so a repeated call cannot pay twice.",
  "how.datamode.h": "Historical simulation versus live",
  "how.datamode.p1":
    "A historical simulation claim is judged against recorded observations. The values are fixed; re-running the claim does not change them. A live claim is judged against data fetched at evaluation time, and a new evaluation can produce a new answer. Every policy and claim surface in this app carries a badge saying which one it is.",
  "how.datamode.p2":
    "The evidence shown in this app is read from the deployed contract at {address} on {network} (chain {id}). When a chain read is not possible, the page says so and shows a recorded snapshot instead of silently presenting stale data as live.",
  "how.limits.h": "Limitations",
  "how.limits.l1":
    "Weather sources differ by a factor of two on the same day. That is real model spread, not a bug, and it is exactly why agreement rules exist.",
  "how.limits.l2":
    "Reanalysis sources report the grid cell they used, which can sit several kilometres from the point you asked for. A tight distance tolerance will produce inconclusive results.",
  "how.limits.l3":
    "The public StudioNet endpoint is rate limited to 30 requests per minute, so reads are spaced out and de-duplicated.",
  "how.limits.l4ok":
    "Claims on the public test networks are not settled for real value.",
  "how.limits.l4down":
    "The StudioNet explorer is currently paused, so transaction links are shown as unavailable rather than as dead links.",

  // --- claims list ---------------------------------------------------------
  "claims.h1": "Claims",
  "claims.lede": "Every claim below exists on the deployed contract at {address} on {network}.",
  "claims.empty": "No claims yet. Start one from a policy on the policies page.",
  "claims.emptyLink": "policies page",
  "claims.caption.one": "{count} claim read from the chain{suffix}.",
  "claims.caption.many": "{count} claims read from the chain{suffix}.",
  "claims.captionSnapshot": " (recorded snapshot)",
  "claims.col.claim": "Claim",
  "claims.col.policy": "Policy",
  "claims.col.state": "State",
  "claims.col.decision": "Decision",
  "claims.col.round": "Round",
  "claims.col.final": "Final",
  "claims.evalFailed": "Evaluation did not complete",
  "claims.footer": "Demo mode replays eight documented scenarios, including ones with no on-chain claim.",

  // --- policies list -------------------------------------------------------
  "policies.h1": "Policies",
  "policies.lede":
    "A policy fixes the location, period, threshold, aggregation rule and eligible sources. Once a claim references it, it cannot be changed.",
  "policies.empty": "No policies yet. Open the demo to see what a policy produces.",
  "policies.caption": "{count} policies on the deployed contract.",
  "policies.col.policy": "Policy",
  "policies.col.location": "Location",
  "policies.col.condition": "Condition",
  "policies.col.dataMode": "Data mode",
  "policies.col.status": "Status",
  "policies.new": "Create a policy",
  "policies.openList": "Open the policies list",
  "policies.notFound.h": "Policy not found",
  "policies.notFound.title": "No policy called “{id}”",
  "policies.notFound.body":
    "It may have been removed, or the address may be from a different deployment.",
  "policies.detail.h": "Policy {id}",
  "policies.detail.locked":
    "This policy is referenced by a claim, so it can no longer be changed.",
  "policies.detail.lockedBody":
    "Immutability after first use is what makes a decision auditable later: the terms a validator judged against cannot drift.",
  "policies.terms.h": "Terms",
  "policies.terms.condition": "Condition",
  "policies.terms.location": "Location",
  "policies.terms.tolerance": "Distance tolerance",
  "policies.terms.period": "Observation period",
  "policies.terms.metric": "Metric",
  "policies.terms.aggregation": "Aggregation",
  "policies.terms.sources": "Eligible sources",
  "policies.terms.agreement": "Agreement rule",
  "policies.terms.minSources": "Minimum sources",
  "policies.terms.payout": "Payout",
  "policies.terms.beneficiary": "Beneficiary",
  "policies.sources.h": "Eligible sources",
  "policies.claims.h": "Claims on this policy",
  "policies.startHere": "Start a claim",

  // --- create policy -------------------------------------------------------
  "policyNew.h1": "Create a policy",
  "policyNew.lede":
    "A policy fixes the location, period, threshold, aggregation rule and eligible sources in advance. Once a claim references it, it can never be changed — that is what makes a later decision auditable.",
  "policyNew.ownerOnly": "This write is owner-only",
  "policyNew.ownerOnlyBody": "Only the contract owner can create a policy.",
  "policyNew.wrongNetwork": "Wrong network",
  "policyNew.terms.h": "Terms",
  "policyNew.f.location": "Location name",
  "policyNew.f.lat": "Latitude (degrees)",
  "policyNew.f.lon": "Longitude (degrees)",
  "policyNew.f.tolerance": "Distance tolerance (metres)",
  "policyNew.f.toleranceHelp":
    "How far an observation's station or grid cell may sit from the coordinates and still count.",
  "policyNew.f.timezone": "Timezone",
  "policyNew.f.timezoneHelp":
    "Observation windows are UTC calendar days, and the contract rejects any other value.",
  "policyNew.f.metric": "Metric",
  "policyNew.f.metricHelp": "The unit follows the metric — the contract only accepts the canonical unit.",
  "policyNew.f.periodStart": "Observation period start",
  "policyNew.f.periodEnd": "Observation period end",
  "policyNew.f.comparator": "Threshold comparison",
  "policyNew.f.threshold": "Threshold",
  "policyNew.f.thresholdHelp": "Stored as an integer ×100 — never a float.",
  "policyNew.f.aggregation": "Aggregation rule",
  "policyNew.f.agreement": "Source agreement rule",
  "policyNew.f.minSources": "Minimum agreeing sources",
  "policyNew.f.payout": "Payout (base units)",
  "policyNew.f.dataMode": "Data mode",
  "policyNew.f.dataModeHelp":
    "The contract seeds no sources of its own — the registry holds only what the owner registers.",
  "policyNew.mode.historical": "Historical simulation",
  "policyNew.mode.historicalHelp":
    "Recorded historical observations, not a live feed. The period must be entirely in the past; re-running the claim cannot change the underlying data.",
  "policyNew.mode.live": "Live",
  "policyNew.mode.liveHelp":
    "Values are fetched from the source at evaluation time. The result reflects the world now and can differ between evaluations.",
  "policyNew.f.condition": "Condition, in plain words",
  "policyNew.f.conditionHelp":
    "Filled from the summary below until you edit it. Stored on chain as the human-readable form of the policy.",
  "policyNew.confirm.h": "Confirm the sentence",
  "policyNew.confirm.help":
    "This is what validators will read. Check it says what you mean — a typo here is a term of the policy.",
  "policyNew.submit": "Create policy",
  "policyNew.cancel": "Cancel",
  "policyNew.clearDraft": "Clear form",
  "policyNew.draftRestored":
    "Draft restored from your last visit on this device.",
  "policyNew.submitting": "Creating",
  "policyNew.validation": "Fix the highlighted fields first.",

  // --- claim detail --------------------------------------------------------
  "claimDetail.notFound.h": "Claim not found",
  "claimDetail.notFound.title": "No claim called “{id}”",
  "claimDetail.notFound.body": "It may have been removed, or the address may be from a different deployment.",
  "claimDetail.h1": "Claim {id}",
  "claimDetail.evidence": "Evidence",
  "claimDetail.checks": "Checks",
  "claimDetail.actions": "Actions",
  "claimDetail.noWallet": "No wallet detected",
  "claimDetail.noWalletBody":
    "Reading claims is open to everyone. Sending a transaction needs a browser wallet.",
  "claimDetail.wrongNetwork": "Wrong network",
  "claimDetail.startEvaluation": "Run evaluation",
  "claimDetail.finalize": "Finalize decision",
  "claimDetail.finalizeHelp":
    "Re-reads the decision at finality; refuses if it changed. Owner only.",
  "claimDetail.reevaluate": "Re-evaluate",
  "claimDetail.reevaluateHelp": "Runs a new evaluation round. The open grounds are kept in the history.",
  "claimDetail.dispute.open": "Dispute open",
  "claimDetail.dispute.title": "Dispute",
  "claimDetail.dispute.grounds": "Grounds for the dispute",
  "claimDetail.dispute.placeholder":
    "Why should this decision be challenged? Name the source, station or observation period you believe the validators judged incorrectly.",
  "claimDetail.dispute.help":
    "The contract stores this text with the dispute and requires it to be non-empty, at least 10 characters long.",
  "claimDetail.dispute.submit": "Open dispute",
  "claimDetail.dispute.helpIntro":
    "These grounds are stored on chain and move into the dispute history once the dispute is opened.",
  "claimDetail.settle.h": "Settlement",
  "claimDetail.settle.none": "This policy has no payout amount, so there is nothing to settle.",
  "claimDetail.settle.gate":
    "Emitting the payout is only enabled once the decision is final. An accepted decision can still be appealed.",
  "claimDetail.settle.ownerOnly": "Owner only.",
  "claimDetail.settle.emit": "Emit payout",
  "claimDetail.settle.emitted":
    "Payout emitted - delivery not yet verified",
  "claimDetail.settle.emittedFull":
    "The payout message is out, so the claim is not settled yet. On GenLayer the value leaves this contract immediately but reaches the recipient only when the message's child transaction activates, and that transaction can still fail. Confirm it in the contract to record the outcome. Never infer delivery from a recipient's balance.",
  "claimDetail.settle.markFailed": "Mark payout failed (retryable)",
  "claimDetail.settle.failed":
    "The last payout attempt failed, so nothing was paid. The claim is retryable: emit the payout again once the cause is fixed.",
  "claimDetail.timeline.h": "Progress",
  "claimDetail.copySummary": "Copy summary",
  "claimDetail.disputes.h": "Disputes",

  // --- demo ----------------------------------------------------------------
  "demo.h1": "Demo mode",
  "demo.lede":
    "Eight scenarios covering the outcomes a real claim can reach. Each one says what it tests, shows the readings it was decided on, and is labelled with where the data came from.",
  "demo.whatItTests": "What this tests:",
  "demo.rejected": "This attempt is rejected",
  "demo.rejectedBody": "No decision, because no claim was created. The attempt above was rejected.",
  "demo.decision": "Decision",
  "demo.checks": "Checks recorded on chain",
  "demo.scenarios": "Scenarios",
  "demo.howToRead": "How to read this",
  "demo.howToReadBody":
    "Each scenario shows the decision, the per-check statuses, the audit record and the transaction lifecycle.",
  "demo.whereNumbers": "Where the numbers come from",
  "demo.whereNumbersBody":
    "The readings are a real recorded source response, and the outcome shown is what the contract's evaluation rules produce for that data. It is not a transaction and is never labelled as one.",
  "demo.whereNumbersBody2":
    "Readings come from the documented source endpoints, or from a recorded response captured from live endpoints. No weather value in this demo was invented.",
  "demo.startClaim": "Start a claim",
  "demo.evaluate": "Evaluate",
  "demo.badgeLive": "{id} read from the chain",
  "demo.badgeReplay": "outcome the contract’s rules produce",
  "demo.provenance.onChain": "on-chain",
  "demo.provenance.replay": "replay",
  "demo.provenance.onChainBody":
    "means the decision shown is read from the deployed contract at {address}. Open it to see the real evidence, checks, audit record and transaction lifecycle.",
  "demo.provenance.replayBody":
    "means the daily readings are a real recorded source response, and the outcome shown is what the contract's evaluation rules produce for that data. It is not a transaction and is never labelled as one.",
  "demo.pinnedBy": "Every scenario’s outcome is pinned by a direct test:",
  "demo.fixtures":
    "All recorded readings live in fixtures/historical/ and were re-verified against the live endpoints. No weather value in this demo was invented.",
  "demo.network": "Network: {network} (chain {id}).",
  "demo.explorerLive": "Explorer links are live.",
  "demo.explorerDown": "The explorer is paused, so links are disabled.",

  // --- claims filtering and pagination -------------------------------------
  "claims.filter.h": "Filter and search",
  "claims.filter.search": "Claim or policy id",
  "claims.filter.decision": "Decision",
  "claims.filter.state": "State",
  "claims.filter.all": "All",
  "claims.filter.pending": "Not decided",
  "claims.filter.clear": "Clear filters",
  "claims.filter.none": "No claims match these filters.",
  "claims.filter.showing": "Showing {shown} of {total} claims.",
  "claims.pagination.prev": "Previous",
  "claims.pagination.next": "Next",
  "claims.pagination.page": "Page {page} of {pages}",

  // --- policy form: honest loading/empty/incomplete states -----------------
  "policyNew.sources.loading": "Loading the source registry…",
  "policyNew.sources.emptyH": "No source measures {metric}",
  "policyNew.sources.empty": "The contract cannot create a policy without a registered source, and none measuring {metric} is on file — the registry was unreadable or genuinely empty. Retry the read, or ask the owner to register one with register_source.",
  "policyNew.sources.recorded": "Showing the recorded registry snapshot; the live read failed ({error}).",
  "policyNew.confirm.incomplete": "Still missing: {fields}",
  "policyNew.missing.location": "location name",
  "policyNew.missing.dates": "observation dates",
  "policyNew.missing.threshold": "threshold",
  "policyNew.missing.sources": "at least one source",

  // --- evidence comparison --------------------------------------------------
  "compare.h": "Per-day source comparison",
  "compare.caption": "Each source's reading for every day of the period, in {unit}. The spread is the highest reading that day minus the lowest.",
  "compare.col.spread": "Spread",
  "compare.col.verdict": "That day",
  "compare.verdict.split": "sources disagree on crossing",
  "compare.verdict.both": "both cross",
  "compare.verdict.neither": "neither crosses",
  "compare.verdict.single": "one source only",
  "compare.noReadings": "no readings",
  "compare.missing": "no reading",
  "compare.incomplete": "incomplete day",
  "compare.summaryOne": "The sources disagree about the threshold on {days}.",
  "compare.summaryNone": "On every day, the sources with readings agree about the threshold.",

  // --- the deterministic-chain contrast ------------------------------------
  "contrast.h": "What a deterministic chain would have said",
  "contrast.badge": "thought experiment",
  "contrast.intro": "A contract that reads one hard-wired source cannot express doubt: it must return pass or fail. These are the answers each single source would force, computed from the same recorded readings.",
  "contrast.sourceCard": "If the contract read {label} only",
  "contrast.verdictConfirmed": "Condition confirmed — payout",
  "contrast.verdictNotConfirmed": "Condition not confirmed — no payout",
  "contrast.observed": "Observed: {value} {unit}",
  "contrast.genlayerCard": "What the deployed contract actually returned",
  "contrast.genlayerVerdict": "Inconclusive — source conflict",
  "contrast.genlayerBody": "The same readings, judged honestly: the sources disagree about crossing and the policy defines no tie-break, so the evidence does not settle the question. No payout is forced either way.",
  "contrast.footnote": "Not a chain result. The left-hand answers are a hypothetical, computed locally from the same recorded readings by the policy's own comparison rule; the right-hand answer is what the contract's evaluation rules produce, pinned by a direct test.",

  // --- chart accessibility --------------------------------------------------
  "evidence.chartAriaOne": "Evidence chart with one source over {days} days.",
  "evidence.chartAriaMany": "Evidence chart with {sources} sources over {days} days.",
  "evidence.pointPass": "{source} — {date}: {value} {unit}, crosses the threshold",
  "evidence.pointFail": "{source} — {date}: {value} {unit}, does not cross the threshold",

  // --- error boundary -------------------------------------------------------
  "errorBoundary.h": "This screen stopped working",
  "errorBoundary.body": "An unexpected problem interrupted this page. The rest of the app still works — try again, or go back to the start.",
  "errorBoundary.home": "Go to the home page",

  // --- print receipt --------------------------------------------------------
  "audit.print": "Print receipt",
  "audit.printHint": "Print this page, or save it as PDF. The print layout keeps only the claim record.",
  "audit.printNote": "Printed {date} · contract {address} · {network}",
} as const;