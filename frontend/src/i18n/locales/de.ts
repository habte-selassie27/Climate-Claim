import type { Dictionary } from "../index";

/** German. Every key in `en` must be present; a gap is a compile error. */
export const de: Dictionary = {
  "common.yes": "ja",
  "common.no": "nein",
  "common.details": "Details",
  "common.loading": "Wird geladen",
  "common.retry": "Erneut versuchen",
  "common.chain": "Chain {id}",
  "common.optional": "optional",
  "common.dash": "—",
  "common.unknown": "Unbekannt",
  "common.notEvaluated": "nicht bewertet",

  "nav.main": "Hauptnavigation",
  "nav.home": "Start",
  "nav.demo": "Demo",
  "nav.claims": "Claims",
  "nav.policies": "Bedingungen",
  "nav.howItWorks": "So funktioniert es",
  "nav.skipToMain": "Zum Hauptinhalt springen",
  "nav.notFound.h": "Seite nicht gefunden",
  "flow.leader": "Der Leader holt die zulässigen Quellen und schlägt ein Ergebnis vor",
  "flow.validators": "Die Validatoren holen dieselben Quellen und bewerten unabhängig",
  "flow.equivalent": "Sind die Ergebnisse äquivalent?",
  "flow.accepted": "Akzeptiert – noch anfechtbar",
  "flow.rejected": "Vorschlag abgelehnt",
  "flow.appealed": "Anfochten?",
  "flow.finalised": "Finalisiert",
  "flow.settled": "Abgerechnet – einmalig gezahlt",
  "flow.yes": "ja",
  "flow.no": "nein",
  "flow.arrowTo": "dann",
  "flow.caption":
    "Wie eine Entscheidung zustande kommt: ein Leader schlägt vor, Validatoren bewerten unabhängig, das Ergebnis bleibt nur erhalten, wenn sie übereinstimmen, dass es dasselbe bedeutet, und nur eine endgültige Entscheidung kann abgerechnet werden.",
  "nav.notFound.body": "Diese Adresse entspricht keiner Seite in dieser Anwendung.",
  "nav.wrongNetwork": "Falsches Netzwerk ({id})",
  "footer.tagline": "Evidenzbasierte parametrische Wetterclaims auf GenLayer.",
  "footer.contract": "Vertrag {address}",
  "footer.explorer": "Explorer",
  "footer.explorerPaused": "Explorer derzeit pausiert",
  "footer.demoMode": "Demo-Modus",

  "theme.label": "Design",
  "theme.system": "System",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "theme.useSystem": "Systemdesign verwenden",
  "theme.useLight": "Helles Design verwenden",
  "theme.useDark": "Dunkles Design verwenden",

  "lang.label": "Sprache",
  "lang.change": "Sprache wechseln",

  "decision.eyebrow": "Entscheidung",
  "decision.confirmed.label": "Bedingung bestätigt",
  "decision.confirmed.sentence":
    "Die aufgezeichneten Nachweise erfüllten die Bedingungen dieser Police.",
  "decision.notConfirmed.label": "Bedingung nicht bestätigt",
  "decision.notConfirmed.sentence":
    "Die aufgezeichneten Nachweise erfüllten die Bedingungen dieser Police nicht.",
  "decision.inconclusive.label": "Unbestimmt",
  "decision.inconclusive.sentence":
    "Die Nachweise klären die Frage in keine Richtung. Das ist ein Ergebnis, kein Fehler.",
  "decision.none.label": "Noch nicht bewertet",
  "decision.none.sentence": "Für diesen Claim gibt es noch keine Entscheidung.",
  "decision.validatorWords": "In den Worten des Validators:",
  "decision.evalFailed": "Diese Bewertung wurde nicht abgeschlossen",
  "decision.errorDetail":
    "Der stabile Fehlerstring des Vertrags lautet {code}. Ein neuer Versuch klappt meist, wenn die Quelle vorübergehend nicht erreichbar war.",
  "decision.claimState": "Claim-Status",
  "decision.highestReading": "Höchster Messwert",
  "decision.threshold": "Schwellenwert",
  "decision.period": "Beobachtungszeitraum",
  "decision.round": "Bewertungsrunde",

  "reason.thresholdCrossed":
    "Mindestens ein Messwert im Beobachtungszeitraum hat den Schwellenwert der Police erreicht.",
  "reason.thresholdNotCrossed":
    "Kein Messwert im Beobachtungszeitraum hat den Schwellenwert der Police erreicht.",
  "reason.sourceConflict":
    "Die zulässigen Quellen widersprachen sich darüber, ob der Schwellenwert überschritten wurde, und die Police definiert keine Regel für Gleichstände.",
  "reason.sourceConflict.resolve":
    "Bestreiten Sie die Entscheidung mit einem Grund, wenn Sie der Meinung sind, dass eine Quelle Vorrang haben sollte.",
  "reason.missingObservations":
    "Die Nachweise decken den gesamten Beobachtungszeitraum nicht ab, daher lässt sich der Schwellenwert nicht beurteilen.",
  "reason.missingObservations.resolve":
    "Starten Sie die Bewertung später erneut, oder bestreiten Sie mit einer Quelle, die den Zeitraum abdeckt.",
  "reason.locationMismatch":
    "Die gemeldete Station liegt außerhalb der Entfernung, die diese Police vom angegebenen Ort erlaubt.",
  "reason.locationMismatch.resolve":
    "Bestreiten Sie, wenn Sie der Meinung sind, dass die Station tatsächlich der richtige Ort ist.",
  "reason.sourcesUnreachable":
    "Keine der zulässigen Quellen war erreichbar, daher gab es nichts zu bewerten.",
  "reason.sourcesUnreachable.resolve":
    "Starten Sie die Bewertung erneut – das ist meist nur vorübergehend.",
  "reason.none": "Es wurde noch kein Grund aufgezeichnet.",

  "check.thresholdCrossed.label": "Schwellenwert überschritten",
  "check.thresholdCrossed.blurb": "Ob ein Messwert den Schwellenwert der Police erreicht hat.",
  "check.periodCovered.label": "Zeitraum abgedeckt",
  "check.periodCovered.blurb": "Ob die Nachweise den gesamten Beobachtungszeitraum abdecken.",
  "check.locationMatch.label": "Ortsübereinstimmung",
  "check.locationMatch.blurb": "Ob die gemeldete Station zum Ort der Police passt.",
  "check.sourceAgreement.label": "Übereinstimmung der Quellen",
  "check.sourceAgreement.blurb": "Ob die zulässigen Quellen übereinstimmten.",
  "check.dataCompleteness.label": "Daten Vollständigkeit",
  "check.dataCompleteness.blurb": "Ob eine Beobachtung im Zeitraum fehlt.",
  "check.status.pass": "Bestanden",
  "check.status.fail": "Fehlgeschlagen",
  "check.status.unclear": "Unklar",
  "check.required": "erforderlich",
  "check.supporting": "unterstützend",
  "check.none": "Für diesen Claim wurden keine Prüfungen aufgezeichnet.",

  "state.created.label": "Erstellt",
  "state.created.blurb": "Der Claim existiert. Nachweise wurden noch nicht angefordert.",
  "state.pendingEvaluation.label": "Wird bewertet",
  "state.pendingEvaluation.blurb":
    "Validatoren holen die Nachweise und vergleichen die Ergebnisse.",
  "state.evidenceCollected.label": "Nachweise gesammelt",
  "state.evidenceCollected.blurb":
    "Die Beobachtungen wurden abgerufen. Es wurde noch keine Entscheidung getroffen.",
  "state.decidedConfirmed.label": "Entscheidung: bestätigt",
  "state.decidedConfirmed.blurb":
    "Eine Entscheidung wurde getroffen und von den Validatoren akzeptiert.",
  "state.decidedNotConfirmed.label": "Entscheidung: nicht bestätigt",
  "state.decidedNotConfirmed.blurb":
    "Eine Entscheidung wurde getroffen und von den Validatoren akzeptiert.",
  "state.inconclusive.label": "Entscheidung: unbestimmt",
  "state.inconclusive.blurb":
    "Eine Entscheidung wurde getroffen: Die Nachweise klären die Frage nicht.",
  "state.disputed.label": "Bestritten",
  "state.disputed.blurb": "Die Entscheidung wird angefochten und wird neu bewertet.",
  "state.settled.label": "Abgerechnet",
  "state.settled.blurb": "Die Auszahlung für diesen Claim wurde vorgenommen.",
  "state.unknown.label": "Unbekannt",
  "state.unknown.blurb": "Dieser Status wird nicht erkannt.",

  "settlement.notSettled": "Nicht abgerechnet",
  "settlement.payoutEmitted": "Auszahlung ausgelöst – Zustellung noch nicht bestätigt",
  "settlement.settled": "Abgerechnet",
  "settlement.failed": "Auszahlung fehlgeschlagen – erneut möglich",
  "settlement.unknown": "Unbekannt",

  "datamode.live.label": "Live",
  "datamode.live.blurb":
    "Die Werte werden zum Zeitpunkt der Bewertung von der Quelle abgerufen. Das Ergebnis spiegelt die Welt von jetzt wider und kann sich ändern, wenn Sie neu bewerten.",
  "datamode.historical.label": "Historische Simulation",
  "datamode.historical.blurb":
    "Die Werte stammen aus archivierten Beobachtungen für ein vollständig in der Vergangenheit liegendes Zeitfenster – nicht aus einem Live-Feed. Der Vertrag ruft das Archiv bei jeder Bewertung erneut ab, sodass eine Überarbeitung der Historie durch den Anbieter sichtbar würde: Dies ist kein eingefrorener Datensatz.",
  "datamode.recorded": "· aufgezeichnet",
  "datamode.mixed": "· gemischt",
  "datamode.recordedTitle": "Aus einem erfassten Snapshot gelesen, nicht aus der Live-Chain.",
  "datamode.mixedTitle":
    "Ein Teil wurde live gelesen; ein Teil stammt aus dem erfassten Snapshot.",

  "origin.live": "Live von {network}",
  "origin.liveTitle": "Live von {network} gelesen.",
  "origin.mixed": "Gemischt: live und aufgezeichnet",
  "origin.mixedTitle":
    "Ein Teil wurde live von {network} gelesen; ein Teil stammt aus dem am {captured} erfassten Snapshot.",
  "origin.checking": "Aufgezeichneter Snapshot · {network} wird geprüft",
  "origin.checkingTitle":
    "Der am {captured} erfasste Snapshot wird angezeigt, während der Live-Abruf läuft.",
  "origin.recorded": "Aufgezeichneter Snapshot",
  "origin.recordedTitle": "Am {captured} erfasster On-Chain-Snapshot.",
  "origin.recordedUnreachable": " (Netzwerk nicht erreichbar)",
  "origin.unreachable": " Das Netzwerk war nicht erreichbar ({error}).",
  "origin.networkDefault": "das Netzwerk",

  "tx.idle": "Noch nicht gesendet",
  "tx.submitted": "An das Netzwerk gesendet",
  "tx.pending": "Validatoren bewerten",
  "tx.accepted": "Akzeptiert – noch anfechtbar",
  "tx.finalized": "Final",
  "tx.failed": "Nicht abgeschlossen",
  "tx.hint.submitted": "Warten darauf, dass das Netzwerk es aufnimmt.",
  "tx.hint.pending":
    "Das kann eine Weile dauern. Validatoren holen die Quellen unabhängig voneinander.",
  "tx.hint.accepted":
    "Die Validatoren stimmen überein. Das Ergebnis ist nicht beständig, bis es final ist.",
  "tx.hint.finalized": "Dieses Ergebnis ist beständig.",
  "tx.hint.failed": "Auf der Chain hat sich nichts geändert.",
  "tx.refresh": "Status aktualisieren",
  "tx.final.final": "Final",
  "tx.final.accepted": "Akzeptiert – noch anfechtbar",
  "tx.final.notYet": "Noch nicht final",

  "error.empty": "Etwas wurde nicht abgeschlossen.",
  "error.expected": "Diese Anfrage ist nicht zulässig.",
  "error.external":
    "Eine Datenquelle war nicht erreichbar, daher gab es nichts zu bewerten.",
  "error.transient": "Im Netzwerk gab es ein vorübergehendes Problem.",
  "error.llm": "Die Bewertung konnte nicht abgeschlossen werden.",
  "error.generic": "Diese Aktion konnte nicht ausgeführt werden.",

  "agg.maxSingle": "der höchste einzelne Messwert an einem beliebigen Tag",
  "agg.cumulative": "die Summe über den gesamten Zeitraum",
  "agg.consecutiveDays": "die längste Reihe aufeinanderfolgender Tage",
  "cmp.gt": "mehr als",
  "cmp.gte": "mindestens",
  "cmp.lt": "weniger als",
  "cmp.lte": "höchstens",
  "policy.sentence":
    "Bestätigt, wenn {aggregation} in {location} an einem beliebigen Tag zwischen {start} und {end} {comparator} {threshold} {unit} beträgt, unter Verwendung von {sources}.",
  "policy.sources.none": "keinen Quellen",
  "policy.sources.two": "{first} und {last}",

  "copy.copy": "Kopieren",
  "copy.copied": "Kopiert",
  "copy.viewOnExplorer": "Im Explorer ansehen",
  "copy.explorerUnavailable": "Explorer-Link nicht verfügbar",
  "copy.explorerNoteDefault": "Der Explorer ist derzeit nicht erreichbar.",
  "evidence.chart": "Nachweisdiagramm",
  "evidence.showTable": "Als Tabelle anzeigen",
  "evidence.showChart": "Diagramm anzeigen",
  "evidence.replay": "Erneut abspielen",
  "evidence.summaryCrossedOne": "{label} hat den Schwellenwert an {days} Tag überschritten",
  "evidence.summaryCrossedMany": "{label} hat den Schwellenwert an {days} Tagen überschritten",
  "evidence.summaryMissingOne": "{days} Messwert fehlt und wird nicht geschätzt.",
  "evidence.summaryMissingMany": "{days} Messwerte fehlen und werden nicht geschätzt.",
  "evidence.summaryConflictOne": "Die Quellen widersprechen sich beim Überschreiten an {days} Tag.",
  "evidence.summaryConflictMany": "Die Quellen widersprechen sich beim Überschreiten an {days} Tagen.",
  "evidence.captionTable":
    "Messwerte je Quelle in {unit}, gegenüber einem Schwellenwert von {comparator} {threshold} {unit}.",
  "evidence.noData": "Für diesen Claim gibt es noch keine darzustellenden Nachweise.",
  "evidence.gapLabel": "fehlend",
  "evidence.legend.disagree": "Quellen widersprechen sich",
  "evidence.col.date": "Datum",
  "evidence.col.note": "Hinweis",
  "evidenceTable.col.source": "Quelle",
  "evidenceTable.col.station": "Gemeldete Station",
  "evidenceTable.col.period": "Zeitraum",
  "evidenceTable.col.unit": "Einheit",
  "evidenceTable.col.days": "Tage",
  "evidenceTable.col.crossed": "Überschritten",
  "evidenceTable.col.status": "Status",
  "source.identifier": "Kennung",
  "source.variable": "Variable",
  "source.unit": "Einheit",
  "source.attribution": "Zuordnung",
  "source.quirks": "Bekannte Eigenheiten",
  "source.exampleRequest": "Beispielanfrage",
  "startClaim.heading": "Claim starten",
  "startClaim.periodStart": "Beginn des Claim-Zeitraums",
  "startClaim.periodEnd": "Ende des Claim-Zeitraums",
  "startClaim.retired":
    "Diese Bedingung ist zurückgezogen, daher können darauf keine neuen Claims gestartet werden.",
  "wallet.heading": "Wallet",
  "wallet.detected": "Erkannte Wallets",
  "wallet.account": "Konto",
  "wallet.chooseFirst": "Wählen Sie zuerst oben eine Wallet aus.",
  "wallet.closePanel": "Wallet-Bereich schließen",
  "wallet.eip6963Title":
    "Über window.ethereum gefunden; diese Wallet implementiert EIP-6963 nicht.",
  "evidence.caption.claimDetail":
    "Die Tageswerte stammen aus der aufgezeichneten Quellantwort für diesen Ort und diesen Zeitraum (siehe fixtures/historical/). Der Vertrag speichert den aggregierten Wert und das Überschreitungsflag; die Tagesdetails dienen nur der Anzeige.",
  "evidence.caption.demo":
    "Die Werte sind die aufgezeichnete Antwort des dokumentierten Endpunkts für diesen Ort und diesen Zeitraum. Fehlende Tage werden als schraffierte Lücken dargestellt und niemals geschätzt.",
  "evidence.noSeries":
    "Für diesen Claim gibt es noch keine aufgezeichnete Tagesreihe. Die aggregierten Nachweise, die der Vertrag bewertet hat, stehen in der Nachweistabelle unten.",
  "audit.heading": "Audit",
  "audit.export": "Beleg exportieren (JSON)",
  "audit.exportHint":
    "Lädt das vollständige Prüfprotokoll als JSON-Datei herunter — Richtlinie, Belege, Prüfungen, Entscheidung, Einsprüche und Abwicklung.",
  "audit.criteriaVersion": "Kriterienversion",
  "audit.round": "Bewertungsrunde",
  "audit.reasonCode": "Grundcode",
  "audit.finalized": "Finalisiert",
  "audit.finalizedYes": "ja",
  "audit.finalizedNo": "nein – eine akzeptierte Entscheidung kann noch angefochten werden",
  "audit.claimId": "Claim-ID",
  "audit.policyId": "Policy-ID",
  "audit.contract": "Vertrag",
  "audit.network": "Netzwerk",
  "audit.transaction": "Transaktion",
  "audit.contractAddress": "Vertragsadresse",
  "audit.txHash": "Transaktions-Hash",
  "audit.explorerDown": "Explorer-Links sind derzeit nicht verfügbar",
  "audit.meaningTitle": "Was „bestätigt“ bedeutet – und was nicht",
  "audit.meaning":
    "„Bestätigt“ bedeutet, dass die von den Validatoren abgerufenen Nachweise die von dieser Police festgelegten Bedingungen erfüllten. Es ist keine rechtliche Feststellung und keine Aussage darüber, dass jemand vertraglich zur Zahlung verpflichtet ist. Eine Auszahlung erfolgt erst, wenn die Entscheidung final ist, und nur über den Abrechnungsweg.",
  "timeline.heading": "Fortschritt",
  "timeline.claim": "Claim-Zeitleiste",
  "timeline.disputes": "Anfechtungsverlauf",
  "timeline.caption":
    "Jede Runde behält die Entscheidung, die sie ersetzt hat, sowie die Gründe, die sie infrage stellten.",
  "timeline.col.round": "Runde",
  "timeline.col.grounds": "Gründe",
  "timeline.col.before": "Entscheidung davor",
  "timeline.col.after": "Entscheidung danach",
  "policies.ownerOnlyNote":
    "Nur für den Eigentümer: Der Vertrag registriert Bedingungen über seinen Eigentümer.",
  "policies.noRegistryMatch":
    "Keine Registereinträge passten zu den Quellen dieser Bedingung.",
  "policies.noClaimsYet": "Noch keine Claims zu dieser Bedingung.",

  "wallet.connect": "Wallet verbinden",
  "wallet.connected": "Verbunden",
  "wallet.disconnect": "Trennen",
  "wallet.copyAddress": "Adresse kopieren",
  "wallet.switchNetwork": "Netzwerk wechseln",
  "wallet.noneFound": "Keine injizierte Wallet gefunden",
  "wallet.noneFoundBody":
    "Eine Webseite kann installierte Browser-Erweiterungen nicht auflisten – sie sieht nur Wallets, die sich selbst melden. Installieren oder entsperren Sie eine Wallet-Erweiterung (MetaMask, Rabby, Brave und andere) und laden Sie neu.",
  "wallet.multiFound":
    "Es ist mehr als eine Wallet installiert. Wählen Sie aus, mit welcher diese App spricht – ohne EIP-6963 würde die zuletzt geladene stillschweigend gewinnen.",
  "wallet.onUnknownNetwork": "Verbinden Sie Ihre Wallet mit {network}, um fortzufahren.",

  "landing.h1": "Hat das Wetter das wirklich getan?",
  "landing.lede":
    "ClimateClaim prüft aufgezeichnete Wetterbeobachtungen gegen eine Bedingung, die Sie in klarer Sprache formulieren, und zeigt Ihnen die Messwerte, die zur Antwort geführt haben. Wenn die Nachweise unvollständig sind oder die Quellen sich widersprechen, sagt es das, statt zu raten.",
  "landing.openDemo": "Demo öffnen",
  "landing.seeConflict": "Quellenkonflikt ansehen",
  "landing.seeClaims": "Echte Claims ansehen",
  "landing.disagreement.h": "Eine echte Meinungsverschiedenheit",
  "landing.disagreement.p":
    "Zwei unabhängige Reanalysen desselben Ortes am selben Tag. Eine nennt 1,10 mm, die andere 2,03 mm. Bei einem Schwellenwert von 1,50 mm überschreitet eine den Wert, die andere nicht. Die ehrliche Antwort lautet unbestimmt – und das ist ein Ergebnis, kein Fehler.",
  "landing.whyGenLayer.h": "Warum GenLayer",
  "landing.whyGenLayer.p1":
    "Wetterdaten sind nicht sauber. Eine Quelle kann ausfallen, nur einen Teil des Zeitraums liefern, und zwei gleichermaßen angesehene Reanalysen können sich um den Faktor zwei unterscheiden. Eine Bedingung muss außerdem ausgelegt werden: Welche Station zählt als „das Gebiet“, ob ein Tag genau auf dem Schwellenwert zählt, was zu tun ist, wenn zwei Quellen sich widersprechen.",
  "landing.whyGenLayer.p2":
    "Die Validatoren holen hier unabhängig dieselben Quellen und vergleichen die Bedeutung, nicht die Bytes. Wo die Nachweise die Frage wirklich nicht klären, gibt der Vertrag „unbestimmt“ zurück, statt ein Ja oder Nein zu erzwingen.",
  "landing.whyGenLayer.link": "Wie Konsens, Äquivalenz und Finalität funktionieren",
  "landing.wont.h": "Was es nicht tun wird",
  "landing.wont.l1": "Einen fehlenden Messwert erfinden, interpolieren oder schätzen.",
  "landing.wont.l2":
    "Ein Sprachmodell die Schwellenwert-Arithmetik machen lassen – das ist einfacher Integer-Code.",
  "landing.wont.l3": "Die freundlichere Quelle auswählen, damit ein Claim durchgeht.",
  "landing.wont.l4": "Eine Auszahlung auf eine lediglich akzeptierte Entscheidung abrechnen.",
  "landing.wont.l5": "Aufgezeichnete historische Daten als Live-Daten darstellen.",
  "landing.deployed":
    "Bereitgestellt unter {address} in {network} (Chain {id}). {scaled} Schwellenwerte und Beträge werden als skalierte Integer gespeichert, niemals als Fließkommazahlen.",

  // --- hero evidence field (three.js) --------------------------------------
  "hero.threshold": "Schwelle {value} {unit}",
  "hero.drag": "zum Drehen ziehen",
  "hero.split": "{day}: Quellen widersprechen sich · zum Drehen ziehen",
  "hero.sound.off": "Regen: ohne Ton",
  "hero.sound.on": "Regen: mit Ton",

  "how.h1": "Wie eine Entscheidung zustande kommt",
  "how.lede":
    "Ein Leader schlägt ein Ergebnis vor, mehrere Validatoren prüfen es unabhängig, und das Ergebnis bleibt nur erhalten, wenn genug von ihnen übereinstimmen, dass es dasselbe bedeutet.",
  "how.leader.h": "Leader und Validatoren",
  "how.leader.p1":
    "Für eine Bewertung holt ein Leader die zulässigen Quellen und erzeugt ein strukturiertes Ergebnis: eine Entscheidung, einen Grund, fünf Prüfstatus und einen beobachteten Wert. Dieser Vorschlag wird nicht ungeprüft übernommen. Jeder Validator holt die Quellen selbst, bewertet sie nach den Regeln der Police und erzeugt ein eigenes Ergebnis.",
  "how.leader.p2":
    "Das Ergebnis bleibt erhalten, wenn die Schlussfolgerungen der Validatoren äquivalent sind – das heißt, wenn sie dasselbe meinen, auch wenn die Formulierung abweicht. Ein Validator, dessen eigenes Ergebnis abweicht, lehnt den Vorschlag ab, statt sich ihm zu fügen.",
  "how.equiv.h": "Was als dieselbe Antwort gilt",
  "how.equiv.p1":
    "Wettertext wird nicht Byte für Byte verglichen. Zwei Ergebnisse gelten als äquivalent, wenn:",
  "how.equiv.l1": "die Entscheidung exakt übereinstimmt;",
  "how.equiv.l2": "der Grund derselbe ist oder in einer dokumentierten Äquivalenzgruppe liegt;",
  "how.equiv.l3":
    "jede erforderliche Prüfung – Schwellenwert überschritten, Zeitraum abgedeckt, Daten vollständig – übereinstimmt;",
  "how.equiv.l4":
    "der beobachtete Wert innerhalb einer dokumentierten Toleranz liegt und auf derselben Seite des Schwellenwerts wie die Entscheidung.",
  "how.equiv.p2":
    "Diese letzte Bedingung ist eine bewusste Absicherung. Ein Validator wird ein „bestätigt“ nicht akzeptieren, dessen eigene Zahlen den Schwellenwert verfehlen – Validatoren können sich also nicht auf etwas einigen, das schlicht falsch ist. Einheiten und Zeitzonen werden vor jedem Vergleich normalisiert, und die Schwellenwert-Arithmetik ist einfacher Integer-Code – niemals Aufgabe des Sprachmodells.",
  "how.inconclusive.h": "Warum es „unbestimmt“ gibt",
  "how.inconclusive.p1":
    "Wenn die Nachweise die Frage nicht klären, lautet die ehrliche Antwort, dass sie sie nicht klären. ClimateClaim gibt in vier unterschiedlichen Situationen „unbestimmt“ zurück:",
  "how.inconclusive.l1t": "Quellenkonflikt",
  "how.inconclusive.l1d":
    "zwei Quellen widersprechen sich beim Überschreiten, und die Police definiert keine Gleichstandsregel.",
  "how.inconclusive.l2t": "Fehlende Beobachtungen",
  "how.inconclusive.l2d":
    "der Zeitraum ist nicht vollständig abgedeckt. Die Lücke wird ausgewiesen, niemals gefüllt.",
  "how.inconclusive.l3t": "Ortsabweichung",
  "how.inconclusive.l3d":
    "die gemeldete Station liegt weiter vom Punkt der Police entfernt, als deren eigene Toleranz erlaubt.",
  "how.inconclusive.l4t": "Quellen nicht erreichbar",
  "how.inconclusive.l4d":
    "es konnte nichts abgerufen werden, daher gab es nichts zu bewerten.",
  "how.inconclusive.p2":
    "Das ist ein Ergebnis, kein Fehler. Es ist zugleich das deutlichste Argument für GenLayer: Eine einzelne deterministische Chain, die eine API liest, müsste den Claim entweder bestehen lassen oder scheitern lassen und hätte keine ehrliche Möglichkeit, die Lücke auszudrücken.",
  "how.finality.h": "Akzeptiert ist nicht final",
  "how.finality.p1":
    "Wenn die Validatoren übereinstimmen, ist das Ergebnis akzeptiert. Es kann noch angefochten werden. Erst wenn das Netzwerk es finalisiert, wird es final, und erst dann kann eine Auszahlung erfolgen. Diese App zeigt diese beiden Zustände auf jeder Ebene getrennt, und die Abrechnungs-Schaltfläche bleibt deaktiviert, bis der Vertrag selbst die Entscheidung als final meldet.",
  "how.finality.p2":
    "Ein abgerechneter Claim kann nur einmal abgerechnet werden. Der Vertrag speichert einen Abrechnungsstatus und prüft ihn vor jeder Übertragung, sodass ein wiederholter Aufruf nicht doppelt zahlen kann.",
  "how.datamode.h": "Historische Simulation gegenüber Live",
  "how.datamode.p1":
    "Ein Claim in historischer Simulation wird anhand aufgezeichneter Beobachtungen beurteilt. Die Werte sind fest; ein erneuter Durchlauf ändert sie nicht. Ein Live-Claim wird anhand von Daten beurteilt, die zum Zeitpunkt der Bewertung abgerufen werden, und eine neue Bewertung kann eine neue Antwort ergeben. Jede Policy- und Claim-Ansicht in dieser App trägt ein Badge, das angibt, um welchen Fall es sich handelt.",
  "how.datamode.p2":
    "Die in dieser App gezeigten Nachweise werden aus dem bereitgestellten Vertrag unter {address} in {network} (Chain {id}) gelesen. Wenn ein Chain-Read nicht möglich ist, sagt die Seite das und zeigt stattdessen einen aufgezeichneten Snapshot, statt veraltete Daten als live darzustellen.",
  "how.limits.h": "Einschränkungen",
  "how.limits.l1":
    "Wetterquellen unterscheiden sich am selben Tag um den Faktor zwei. Das ist echte Modellstreuung, kein Fehler – und genau der Grund, warum es Übereinstimmungsregeln gibt.",
  "how.limits.l2":
    "Reanalyse-Quellen nennen die verwendete Rasterzelle, die mehrere Kilometer vom angefragten Punkt entfernt liegen kann. Eine enge Distanztoleranz führt zu unbestimmten Ergebnissen.",
  "how.limits.l3":
    "Der öffentliche StudioNet-Endpunkt erlaubt eine begrenzte Anzahl von Reads pro Stunde, daher werden Reads zeitlich verteilt und dedupliziert.",
  "how.limits.l4ok":
    "Claims in den öffentlichen Testnetzwerken werden nicht mit echtem Wert abgerechnet.",
  "how.limits.l4down":
    "Der StudioNet-Explorer ist derzeit pausiert, daher werden Transaktionslinks als nicht verfügbar statt als tote Links angezeigt.",

  "claims.h1": "Claims",
  "claims.lede":
    "Alle Claims unten existieren im bereitgestellten Vertrag unter {address} in {network}.",
  "claims.empty":
    "Noch keine Claims. Starten Sie einen über eine Bedingung auf der Seite für Bedingungen.",
  "claims.emptyLink": "Seite für Bedingungen",
  "claims.caption.one": "{count} Claim von der Chain gelesen{suffix}.",
  "claims.caption.many": "{count} Claims von der Chain gelesen{suffix}.",
  "claims.captionSnapshot": " (aufgezeichneter Snapshot)",
  "claims.col.claim": "Claim",
  "claims.col.policy": "Bedingung",
  "claims.col.state": "Status",
  "claims.col.decision": "Entscheidung",
  "claims.col.round": "Runde",
  "claims.col.final": "Final",
  "claims.evalFailed": "Die Bewertung wurde nicht abgeschlossen",
  "claims.footer":
    "Der Demo-Modus spielt acht dokumentierte Szenarien ab, darunter auch solche ohne On-Chain-Claim.",

  "policies.h1": "Bedingungen",
  "policies.lede":
    "Eine Bedingung legt Ort, Zeitraum, Schwellenwert, Aggregationsregel und zulässige Quellen fest. Sobald ein Claim darauf verweist, kann sie nicht mehr geändert werden.",
  "policies.empty": "Noch keine Bedingungen. Öffnen Sie die Demo, um zu sehen, was eine Bedingung bewirkt.",
  "policies.caption": "{count} Bedingungen im bereitgestellten Vertrag.",
  "policies.col.policy": "Bedingung",
  "policies.col.location": "Ort",
  "policies.col.condition": "Bedingung",
  "policies.col.dataMode": "Datenmodus",
  "policies.col.status": "Status",
  "policies.new": "Bedingung erstellen",
  "policies.openList": "Liste der Bedingungen öffnen",
  "policies.notFound.h": "Bedingung nicht gefunden",
  "policies.notFound.title": "Keine Bedingung namens „{id}“",
  "policies.notFound.body":
    "Sie wurde möglicherweise entfernt, oder die Adresse stammt aus einer anderen Bereitstellung.",
  "policies.detail.h": "Bedingung {id}",
  "policies.detail.locked":
    "Diese Bedingung wird von einem Claim referenziert und kann daher nicht mehr geändert werden.",
  "policies.detail.lockedBody":
    "Unveränderlichkeit nach der ersten Verwendung macht eine Entscheidung später prüfbar: Die Bedingungen, gegen die ein Validator beurteilt hat, können nicht abweichen.",
  "policies.terms.h": "Bedingungen",
  "policies.terms.condition": "Bedingung",
  "policies.terms.location": "Ort",
  "policies.terms.tolerance": "Distanztoleranz",
  "policies.terms.period": "Beobachtungszeitraum",
  "policies.terms.metric": "Messgröße",
  "policies.terms.aggregation": "Aggregation",
  "policies.terms.sources": "Zulässige Quellen",
  "policies.terms.agreement": "Übereinstimmungsregel",
  "policies.terms.minSources": "Mindestanzahl Quellen",
  "policies.terms.payout": "Auszahlung",
  "policies.terms.beneficiary": "Begünstigter",
  "policies.sources.h": "Zulässige Quellen",
  "policies.claims.h": "Claims zu dieser Bedingung",
  "policies.startHere": "Claim starten",

  "policyNew.h1": "Bedingung erstellen",
  "policyNew.lede":
    "Eine Bedingung legt Ort, Zeitraum, Schwellenwert, Aggregationsregel und zulässige Quellen im Voraus fest. Sobald ein Claim darauf verweist, kann sie nie mehr geändert werden – das macht eine spätere Entscheidung prüfbar.",
  "policyNew.ownerOnly": "Dieser Schreibvorgang ist dem Eigentümer vorbehalten",
  "policyNew.ownerOnlyBody": "Nur der Eigentümer des Vertrags kann eine Bedingung erstellen.",
  "policyNew.wrongNetwork": "Falsches Netzwerk",
  "policyNew.terms.h": "Bedingungen",
  "policyNew.f.location": "Ortsname",
  "policyNew.f.lat": "Breitengrad",
  "policyNew.f.lon": "Längengrad",
  "policyNew.f.tolerance": "Distanztoleranz (Meter)",
  "policyNew.f.toleranceHelp":
    "Wie weit die Station oder Rasterzelle einer Beobachtung von den Koordinaten entfernt sein darf und noch zählt.",
  "policyNew.f.timezone": "Zeitzone",
  "policyNew.f.timezoneHelp":
    "Beobachtungsfenster sind UTC-Kalendertage; der Vertrag lehnt jeden anderen Wert ab.",
  "policyNew.f.metric": "Messgröße",
  "policyNew.f.metricHelp":
    "Die Einheit folgt der Messgröße – der Vertrag akzeptiert nur die kanonische Einheit.",
  "policyNew.f.periodStart": "Beginn des Beobachtungszeitraums",
  "policyNew.f.periodEnd": "Ende des Beobachtungszeitraums",
  "policyNew.f.comparator": "Schwellenvergleich",
  "policyNew.f.threshold": "Schwellenwert",
  "policyNew.f.thresholdHelp": "Als Integer ×100 gespeichert – niemals als Fließkommazahl.",
  "policyNew.f.aggregation": "Aggregationsregel",
  "policyNew.f.agreement": "Übereinstimmungsregel der Quellen",
  "policyNew.f.minSources": "Mindestanzahl übereinstimmender Quellen",
  "policyNew.f.payout": "Auszahlung (Basiseinheiten)",
  "policyNew.f.dataMode": "Datenmodus",
  "policyNew.f.dataModeHelp":
    "Der Vertrag setzt keine eigenen Quellen ein – das Register enthält nur, was der Eigentümer einträgt.",
  "policyNew.mode.historical": "Historische Simulation",
  "policyNew.mode.historicalHelp":
    "Aufgezeichnete historische Beobachtungen, kein Live-Feed. Der Zeitraum muss vollständig in der Vergangenheit liegen; ein erneuter Durchlauf kann die zugrunde liegenden Daten nicht ändern.",
  "policyNew.mode.live": "Live",
  "policyNew.mode.liveHelp":
    "Die Werte werden zum Zeitpunkt der Bewertung von der Quelle abgerufen. Das Ergebnis spiegelt die Welt von jetzt wider und kann zwischen Bewertungen abweichen.",
  "policyNew.f.condition": "Bedingung, in klaren Worten",
  "policyNew.f.conditionHelp":
    "Wird aus der Zusammenfassung unten gefüllt, bis Sie sie bearbeiten. Auf der Chain als lesbare Form der Bedingung gespeichert.",
  "policyNew.confirm.h": "Satz bestätigen",
  "policyNew.confirm.help":
    "Das werden die Validatoren lesen. Prüfen Sie, ob es das sagt, was Sie meinen – ein Tippfehler hier ist eine Bedingung der Police.",
  "policyNew.submit": "Bedingung erstellen",
  "policyNew.cancel": "Abbrechen",
  "policyNew.clearDraft": "Formular leeren",
  "policyNew.draftRestored":
    "Entwurf aus Ihrem letzten Besuch auf diesem Gerät wiederhergestellt.",
  "policyNew.submitting": "Wird erstellt",
  "policyNew.validation": "Beheben Sie zuerst die markierten Felder.",

  "claimDetail.notFound.h": "Claim nicht gefunden",
  "claimDetail.notFound.title": "Kein Claim namens „{id}“",
  "claimDetail.notFound.body":
    "Er wurde möglicherweise entfernt, oder die Adresse stammt aus einer anderen Bereitstellung.",
  "claimDetail.h1": "Claim {id}",
  "claimDetail.evidence": "Nachweise",
  "claimDetail.checks": "Prüfungen",
  "claimDetail.actions": "Aktionen",
  "claimDetail.noWallet": "Keine Wallet erkannt",
  "claimDetail.noWalletBody":
    "Claims lesen ist für alle offen. Das Senden einer Transaktion erfordert eine Browser-Wallet.",
  "claimDetail.wrongNetwork": "Falsches Netzwerk",
  "claimDetail.startEvaluation": "Bewertung starten",
  "claimDetail.finalize": "Entscheidung finalisieren",
  "claimDetail.finalizeHelp":
    "Liest die Entscheidung bei der Finalität erneut; lehnt ab, wenn sie sich geändert hat. Nur für den Eigentümer.",
  "claimDetail.reevaluate": "Neu bewerten",
  "claimDetail.reevaluateHelp":
    "Führt eine neue Bewertungsrunde aus. Offene Gründe bleiben im Verlauf erhalten.",
  "claimDetail.dispute.open": "Anfechtung offen",
  "claimDetail.dispute.title": "Anfechten",
  "claimDetail.dispute.grounds": "Gründe für die Anfechtung",
  "claimDetail.dispute.placeholder":
    "Warum sollte diese Entscheidung angefochten werden? Nennen Sie die Quelle, die Station oder den Beobachtungszeitraum, den Sie für falsch beurteilt halten.",
  "claimDetail.dispute.help":
    "Der Vertrag speichert diesen Text mit der Anfechtung und verlangt, dass er nicht leer und mindestens 10 Zeichen lang ist.",
  "claimDetail.dispute.submit": "Anfechtung eröffnen",
  "claimDetail.dispute.helpIntro":
    "Diese Gründe werden auf der Chain gespeichert und wandern mit der Eröffnung in den Anfechtungsverlauf.",
  "claimDetail.settle.h": "Abrechnung",
  "claimDetail.settle.none":
    "Diese Bedingung hat keinen Auszahlungsbetrag, daher gibt es nichts abzurechnen.",
  "claimDetail.settle.gate":
    "Das Auslösen der Auszahlung ist erst möglich, wenn die Entscheidung final ist. Eine akzeptierte Entscheidung kann noch angefochten werden.",
  "claimDetail.settle.ownerOnly": "Nur für den Eigentümer.",
  "claimDetail.settle.emit": "Auszahlung auslösen",
  "claimDetail.settle.emitted": "Auszahlung ausgelöst – Zustellung noch nicht bestätigt",
  "claimDetail.settle.emittedFull":
    "Die Auszahlungsnachricht ist unterwegs, der Claim ist daher noch nicht abgerechnet. Auf GenLayer verlässt der Wert diesen Vertrag sofort, erreicht den Begünstigten aber erst, wenn die Kind-Transaktion der Nachricht aktiviert wird – und diese kann weiterhin fehlschlagen. Bestätigen Sie sie im Vertrag, um das Ergebnis zu protokollieren. Leiten Sie die Zustellung niemals aus dem Saldo des Begünstigten ab.",
  "claimDetail.settle.markFailed": "Auszahlung als fehlgeschlagen markieren (erneut möglich)",
  "claimDetail.settle.failed":
    "Der letzte Auszahlungsversuch ist fehlgeschlagen, es wurde also nichts gezahlt. Der Claim kann erneut versucht werden: Lösen Sie die Auszahlung erneut aus, sobald die Ursache behoben ist.",
  "claimDetail.timeline.h": "Fortschritt",
  "claimDetail.copySummary": "Zusammenfassung kopieren",
  "claimDetail.disputes.h": "Anfechtungen",

  "demo.h1": "Demo-Modus",
  "demo.lede":
    "Acht Szenarien, die die Ergebnisse abdecken, die ein echter Claim erreichen kann. Jedes sagt, was es prüft, zeigt die Messwerte, auf denen entschieden wurde, und ist mit der Herkunft der Daten beschriftet.",
  "demo.whatItTests": "Was dies prüft:",
  "demo.rejected": "Dieser Versuch wird abgelehnt",
  "demo.rejectedBody":
    "Keine Entscheidung, weil kein Claim erstellt wurde. Der Versuch oben wurde abgelehnt.",
  "demo.decision": "Entscheidung",
  "demo.checks": "Auf der Chain aufgezeichnete Prüfungen",
  "demo.scenarios": "Szenarien",
  "demo.howToRead": "So ist das zu lesen",
  "demo.howToReadBody":
    "Jedes Szenario zeigt die Entscheidung, die Prüfstatus, den Audit-Eintrag und den Transaktionsablauf.",
  "demo.whereNumbers": "Woher die Zahlen stammen",
  "demo.whereNumbersBody":
    "Die Messwerte sind eine echte aufgezeichnete Quellantwort, und das gezeigte Ergebnis ist das, was die Bewertungsregeln des Vertrags für diese Daten ergeben. Es ist keine Transaktion und wird auch nie als eine bezeichnet.",
  "demo.whereNumbersBody2":
    "Die Messwerte stammen aus den dokumentierten Quell-Endpunkten oder aus einer aufgezeichneten Antwort, die von Live-Endpunkten erfasst wurde. In dieser Demo wurde kein Wetterwert erfunden.",
  "demo.startClaim": "Claim starten",
  "demo.evaluate": "Bewerten",
  "demo.badgeLive": "{id} von der Chain gelesen",
  "demo.badgeReplay": "Ergebnis der Vertragsregeln",
  "demo.provenance.onChain": "on-chain",
  "demo.provenance.replay": "Replay",
  "demo.provenance.onChainBody":
    "bedeutet, dass die gezeigte Entscheidung aus dem bereitgestellten Vertrag unter {address} gelesen wird. Öffnen Sie ihn, um die echten Nachweise, die Prüfungen, den Audit-Eintrag und den Transaktionsablauf zu sehen.",
  "demo.provenance.replayBody":
    "bedeutet, dass die Tageswerte eine echte aufgezeichnete Quellantwort sind und das gezeigte Ergebnis das ist, was die Bewertungsregeln des Vertrags für diese Daten ergeben. Es ist keine Transaktion und wird auch nie als eine dargestellt.",
  "demo.pinnedBy": "Das Ergebnis jedes Szenarios ist durch einen direkten Test festgeschrieben:",
  "demo.fixtures":
    "Alle aufgezeichneten Messwerte liegen in fixtures/historical/ und wurden gegen die Live-Endpunkte erneut geprüft. In dieser Demo wurde kein Wetterwert erfunden.",
  "demo.network": "Netzwerk: {network} (Chain {id}).",
  "demo.explorerLive": "Die Explorer-Links sind aktiv.",
  "demo.explorerDown": "Der Explorer ist pausiert; die Links sind deaktiviert.",

  // --- claims filtering and pagination -------------------------------------
  "claims.filter.h": "Filtern und suchen",
  "claims.filter.search": "Anspruchs- oder Policen-ID",
  "claims.filter.decision": "Entscheidung",
  "claims.filter.state": "Status",
  "claims.filter.all": "Alle",
  "claims.filter.pending": "Nicht entschieden",
  "claims.filter.clear": "Filter löschen",
  "claims.filter.none": "Keine Ansprüche passen zu diesen Filtern.",
  "claims.filter.showing": "{shown} von {total} Ansprüchen angezeigt.",
  "claims.pagination.prev": "Zurück",
  "claims.pagination.next": "Weiter",
  "claims.pagination.page": "Seite {page} von {pages}",

  // --- policy form: honest loading/empty/incomplete states -----------------
  "policyNew.sources.loading": "Quellenregister wird geladen…",
  "policyNew.sources.emptyH": "Keine Quelle misst {metric}",
  "policyNew.sources.empty": "Der Vertrag kann keine Police ohne registrierte Quelle erstellen, und keine mit der Messgröße {metric} ist hinterlegt — das Register war nicht lesbar oder wirklich leer. Wiederholen Sie das Lesen, oder bitten Sie den Eigentümer, eine mit register_source zu registrieren.",
  "policyNew.sources.recorded": "Es wird der aufgezeichnete Register-Schnappschuss angezeigt; das Live-Lesen ist fehlgeschlagen ({error}).",
  "policyNew.confirm.incomplete": "Es fehlt noch: {fields}",
  "policyNew.missing.location": "der Ortsname",
  "policyNew.missing.dates": "die Beobachtungsdaten",
  "policyNew.missing.threshold": "der Schwellenwert",
  "policyNew.missing.sources": "mindestens eine Quelle",

  // --- evidence comparison --------------------------------------------------
  "compare.h": "Quellenvergleich pro Tag",
  "compare.caption": "Die Messung jeder Quelle für jeden Tag des Zeitraums, in {unit}. Die Spanne ist die höchste Messung des Tages minus der niedrigsten.",
  "compare.col.spread": "Spanne",
  "compare.col.verdict": "An diesem Tag",
  "compare.verdict.split": "Quellen widersprechen sich beim Überschreiten",
  "compare.verdict.both": "beide überschreiten",
  "compare.verdict.neither": "keine überschreitet",
  "compare.verdict.single": "nur eine Quelle",
  "compare.noReadings": "keine Messungen",
  "compare.missing": "keine Messung",
  "compare.incomplete": "unvollständiger Tag",
  "compare.summaryOne": "Die Quellen widersprechen sich beim Schwellenwert am {days}.",
  "compare.summaryNone": "An jedem Tag stimmen die Quellen mit Messungen beim Schwellenwert überein.",

  // --- the deterministic-chain contrast ------------------------------------
  "contrast.h": "Was eine deterministische Chain geantwortet hätte",
  "contrast.badge": "Gedankenexperiment",
  "contrast.intro": "Ein Vertrag, der eine fest verdrahtete Quelle liest, kann keine Zweifel ausdrücken: Er muss Ja oder Nein zurückgeben. Dies sind die Antworten, die jede einzelne Quelle erzwingen würde — berechnet aus denselben aufgezeichneten Messwerten.",
  "contrast.sourceCard": "Wenn der Vertrag nur {label} lesen würde",
  "contrast.verdictConfirmed": "Bedingung bestätigt — Auszahlung",
  "contrast.verdictNotConfirmed": "Bedingung nicht bestätigt — keine Auszahlung",
  "contrast.observed": "Beobachtet: {value} {unit}",
  "contrast.genlayerCard": "Was der bereitgestellte Vertrag tatsächlich zurückgab",
  "contrast.genlayerVerdict": "Nicht conclusiv — Quellenkonflikt",
  "contrast.genlayerBody": "Dieselben Messwerte, ehrlich beurteilt: Die Quellen widersprechen sich beim Überschreiten, und die Police definiert keine Stichentscheidung — die Evidenz entscheidet die Frage also nicht. Es wird in keine Richtung eine Auszahlung erzwungen.",
  "contrast.footnote": "Kein Chain-Ergebnis. Die Antworten links sind eine Hypothese, lokal berechnet aus denselben aufgezeichneten Messwerten nach der Vergleichsregel der Police; die Antwort rechts ist das, was die Bewertungsregeln des Vertrags erzeugen — festgehalten durch einen direkten Test.",

  // --- chart accessibility --------------------------------------------------
  "evidence.chartAriaOne": "Evidenzdiagramm mit einer Quelle über {days} Tage.",
  "evidence.chartAriaMany": "Evidenzdiagramm mit {sources} Quellen über {days} Tage.",
  "evidence.pointPass": "{source} — {date}: {value} {unit}, überschreitet den Schwellenwert",
  "evidence.pointFail": "{source} — {date}: {value} {unit}, überschreitet den Schwellenwert nicht",

  // --- error boundary -------------------------------------------------------
  "errorBoundary.h": "Dieser Bildschirm funktioniert nicht mehr",
  "errorBoundary.body": "Ein unerwartetes Problem hat diese Seite unterbrochen. Der Rest der App funktioniert weiter — versuchen Sie es erneut oder kehren Sie zum Start zurück.",
  "errorBoundary.home": "Zur Startseite gehen",

  // --- print receipt --------------------------------------------------------
  "audit.print": "Beleg drucken",
  "audit.printHint": "Diese Seite drucken oder als PDF speichern. Das Drucklayout enthält nur den Anspruchsdatensatz.",
  "audit.printNote": "Gedruckt {date} · Vertrag {address} · {network}",
};