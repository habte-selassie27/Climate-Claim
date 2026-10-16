import type { Dictionary } from "../index";

/** French. Every key in `en` must be present; a gap is a compile error. */
export const fr: Dictionary = {
  "common.yes": "oui",
  "common.no": "non",
  "common.details": "Détails",
  "common.loading": "Chargement",
  "common.retry": "Réessayer",
  "common.chain": "chaîne {id}",
  "common.optional": "facultatif",
  "common.dash": "—",
  "common.unknown": "Inconnu",
  "common.notEvaluated": "non évalué",

  "nav.main": "Principal",
  "nav.home": "Accueil",
  "nav.demo": "Démo",
  "nav.claims": "Réclamations",
  "nav.policies": "Policies",
  "nav.howItWorks": "Fonctionnement",
  "nav.skipToMain": "Aller au contenu principal",
  "nav.notFound.h": "Page introuvable",
  "flow.leader": "Le leader récupère les sources éligibles et propose un résultat",
  "flow.validators": "Les validateurs récupèrent les mêmes sources et évaluent indépendamment",
  "flow.equivalent": "Les résultats sont-ils équivalents ?",
  "flow.accepted": "Accepté — encore contestable",
  "flow.rejected": "Proposition rejetée",
  "flow.appealed": "Contesté ?",
  "flow.finalised": "Finalisé",
  "flow.settled": "Réglé — payé une seule fois",
  "flow.yes": "oui",
  "flow.no": "non",
  "flow.arrowTo": "puis",
  "flow.caption":
    "Comment une décision est prise : un leader propose, les validateurs évaluent indépendamment, le résultat n’est conservé que s’ils admettent qu’il signifie la même chose, et seule une décision finale peut être réglée.",
  "nav.notFound.body": "Cette adresse ne correspond à aucune page de cette application.",
  "nav.wrongNetwork": "Mauvais réseau ({id})",
  "footer.tagline": "Réclamations météo paramétriques fondées sur les preuves, sur GenLayer.",
  "footer.contract": "Contrat {address}",
  "footer.explorer": "Explorateur",
  "footer.explorerPaused": "Explorateur actuellement en pause",
  "footer.demoMode": "Mode démo",

  "theme.label": "Thème",
  "theme.system": "Système",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "theme.useSystem": "Utiliser le thème du système",
  "theme.useLight": "Utiliser le thème clair",
  "theme.useDark": "Utiliser le thème sombre",

  "lang.label": "Langue",
  "lang.change": "Changer de langue",

  "decision.eyebrow": "Décision",
  "decision.confirmed.label": "Condition confirmée",
  "decision.confirmed.sentence": "Les preuves enregistrées respectaient les termes de cette policy.",
  "decision.notConfirmed.label": "Condition non confirmée",
  "decision.notConfirmed.sentence":
    "Les preuves enregistrées ne respectaient pas les termes de cette policy.",
  "decision.inconclusive.label": "Inconcluant",
  "decision.inconclusive.sentence":
    "Les preuves ne tranchent pas la question, dans un sens ou dans l’autre. C’est un résultat, pas une erreur.",
  "decision.none.label": "Pas encore évaluée",
  "decision.none.sentence": "Cette réclamation n’a pas encore de décision.",
  "decision.validatorWords": "Dans les mots du validateur :",
  "decision.evalFailed": "Cette évaluation ne s’est pas terminée",
  "decision.errorDetail":
    "La chaîne d’erreur stable du contrat est {code}. Réessayer fonctionne généralement lorsque la source était temporairement indisponible.",
  "decision.claimState": "État de la réclamation",
  "decision.highestReading": "Relevé le plus élevé",
  "decision.threshold": "Seuil",
  "decision.period": "Période d’observation",
  "decision.round": "Tour d’évaluation",

  "reason.thresholdCrossed":
    "Au moins un relevé de la période d’observation a atteint le seuil de la policy.",
  "reason.thresholdNotCrossed":
    "Aucun relevé de la période d’observation n’a atteint le seuil de la policy.",
  "reason.sourceConflict":
    "Les sources éligibles n’ont pas été d’accord sur le franchissement du seuil, et la policy ne définit aucun départage.",
  "reason.sourceConflict.resolve":
    "Contestez la décision avec un motif si vous pensez qu’une source devrait primer.",
  "reason.missingObservations":
    "Les preuves ne couvrent pas toute la période d’observation ; le seuil ne peut donc pas être jugé.",
  "reason.missingObservations.resolve":
    "Relancez l’évaluation plus tard, ou contestez avec une source qui couvre bien la période.",
  "reason.locationMismatch":
    "La station signalée se trouve hors de la distance que cette policy autorise depuis le lieu indiqué.",
  "reason.locationMismatch.resolve":
    "Contestez si vous pensez que la station est en réalité le bon emplacement.",
  "reason.sourcesUnreachable":
    "Aucune des sources éligibles n’a pu être jointe ; il n’y avait donc rien à évaluer.",
  "reason.sourcesUnreachable.resolve":
    "Relancez l’évaluation — c’est généralement temporaire.",
  "reason.none": "Aucun motif n’a encore été enregistré.",

  "check.thresholdCrossed.label": "Seuil franchi",
  "check.thresholdCrossed.blurb": "Si un relevé a atteint le seuil de la policy.",
  "check.periodCovered.label": "Période couverte",
  "check.periodCovered.blurb": "Si les preuves couvrent toute la période d’observation.",
  "check.locationMatch.label": "Concordance du lieu",
  "check.locationMatch.blurb": "Si la station signalée correspond au lieu de la policy.",
  "check.sourceAgreement.label": "Accord entre sources",
  "check.sourceAgreement.blurb": "Si les sources éligibles sont tombées d’accord.",
  "check.dataCompleteness.label": "Complétude des données",
  "check.dataCompleteness.blurb": "S’il manque une observation sur la période.",
  "check.status.pass": "Réussi",
  "check.status.fail": "Échec",
  "check.status.unclear": "Incertain",
  "check.required": "obligatoire",
  "check.supporting": "d’appoint",
  "check.none": "Aucun contrôle n’a été enregistré pour cette réclamation.",

  "state.created.label": "Créée",
  "state.created.blurb": "La réclamation existe. Les preuves n’ont pas encore été demandées.",
  "state.pendingEvaluation.label": "Évaluation en cours",
  "state.pendingEvaluation.blurb":
    "Les validateurs récupèrent les preuves et comparent les résultats.",
  "state.evidenceCollected.label": "Preuves recueillies",
  "state.evidenceCollected.blurb":
    "Les observations ont été récupérées. Aucune décision n’a encore été prise.",
  "state.decidedConfirmed.label": "Décision : confirmée",
  "state.decidedConfirmed.blurb":
    "Une décision a été prise et acceptée par les validateurs.",
  "state.decidedNotConfirmed.label": "Décision : non confirmée",
  "state.decidedNotConfirmed.blurb":
    "Une décision a été prise et acceptée par les validateurs.",
  "state.inconclusive.label": "Décision : inconcluante",
  "state.inconclusive.blurb":
    "Une décision a été prise : les preuves ne tranchent pas la question.",
  "state.disputed.label": "Contestée",
  "state.disputed.blurb": "La décision est contestée et sera ré-évaluée.",
  "state.settled.label": "Réglée",
  "state.settled.blurb": "Le paiement de cette réclamation a été effectué.",
  "state.unknown.label": "Inconnu",
  "state.unknown.blurb": "Cet état n’est pas reconnu.",

  "settlement.notSettled": "Non réglée",
  "settlement.payoutEmitted": "Paiement émis — livraison pas encore vérifiée",
  "settlement.settled": "Réglée",
  "settlement.failed": "Paiement échoué — réessayable",
  "settlement.unknown": "Inconnu",

  "datamode.live.label": "En direct",
  "datamode.live.blurb":
    "Les valeurs sont récupérées depuis la source au moment de l’évaluation. Le résultat reflète le monde maintenant, et peut changer si vous relancez l’évaluation.",
  "datamode.historical.label": "Simulation historique",
  "datamode.historical.blurb":
    "Les valeurs proviennent d’observations archivées sur une fenêtre entièrement passée — pas d’un flux en direct. Le contrat récupère l’archive à chaque évaluation ; une révision des données par le fournisseur serait donc prise en compte : ce n’est pas un jeu de données figé.",
  "datamode.recorded": "· enregistré",
  "datamode.mixed": "· mixte",
  "datamode.recordedTitle": "Lu depuis un instantané capturé, pas depuis la chaîne en direct.",
  "datamode.mixedTitle":
    "Une partie a été lue en direct ; une autre provient de l’instantané capturé.",

  "origin.live": "En direct depuis {network}",
  "origin.liveTitle": "Lu en direct depuis {network}.",
  "origin.mixed": "Mixte : direct et enregistré",
  "origin.mixedTitle":
    "Une partie a été lue en direct depuis {network} ; une autre provient de l’instantané capturé le {captured}.",
  "origin.checking": "Instantané enregistré · vérification de {network}",
  "origin.checkingTitle":
    "Affichage de l’instantané capturé le {captured} pendant la lecture en direct.",
  "origin.recorded": "Instantané enregistré",
  "origin.recordedTitle": "Instantané enregistré sur la chaîne, capturé le {captured}.",
  "origin.recordedUnreachable": " (réseau injoignable)",
  "origin.unreachable": " Le réseau n’a pas pu être joint ({error}).",
  "origin.networkDefault": "le réseau",

  "tx.idle": "Pas encore envoyé",
  "tx.submitted": "Envoyé au réseau",
  "tx.pending": "Les validateurs évaluent",
  "tx.accepted": "Accepté — encore contestable",
  "tx.finalized": "Final",
  "tx.failed": "Ne s’est pas terminé",
  "tx.hint.submitted": "En attente de prise en charge par le réseau.",
  "tx.hint.pending":
    "Cela peut prendre du temps. Les validateurs récupèrent les sources indépendamment.",
  "tx.hint.accepted":
    "Les validateurs sont d’accord. Le résultat n’est pas définitif tant qu’il n’est pas final.",
  "tx.hint.finalized": "Ce résultat est définitif.",
  "tx.hint.failed": "Rien n’a changé sur la chaîne.",
  "tx.refresh": "Actualiser le statut",
  "tx.final.final": "Final",
  "tx.final.accepted": "Accepté — encore contestable",
  "tx.final.notYet": "Pas encore final",

  "error.empty": "Quelque chose ne s’est pas terminé.",
  "error.expected": "Cette demande n’est pas autorisée.",
  "error.external":
    "Une source de données n’a pas pu être jointe ; il n’y avait donc rien à évaluer.",
  "error.transient": "Un problème temporaire est survenu sur le réseau.",
  "error.llm": "L’évaluation n’a pas pu être terminée.",
  "error.generic": "Cette action n’a pas pu être effectuée.",

  "agg.maxSingle": "le relevé le plus élevé d’une journée quelconque",
  "agg.cumulative": "le total sur toute la période",
  "agg.consecutiveDays": "la plus longue série de jours consécutifs",
  "cmp.gt": "supérieur à",
  "cmp.gte": "au moins",
  "cmp.lt": "inférieur à",
  "cmp.lte": "au plus",
  "policy.sentence":
    "Confirmée si {aggregation} à {location} est {comparator} {threshold} {unit} un jour quelconque entre {start} et {end}, en utilisant {sources}.",
  "policy.sources.none": "aucune source",
  "policy.sources.two": "{first} et {last}",

  "copy.copy": "Copier",
  "copy.copied": "Copié",
  "copy.viewOnExplorer": "Voir sur l’explorateur",
  "copy.explorerUnavailable": "Lien vers l’explorateur indisponible",
  "copy.explorerNoteDefault": "L’explorateur n’est pas disponible actuellement.",
  "evidence.chart": "Graphique des preuves",
  "evidence.showTable": "Afficher sous forme de tableau",
  "evidence.showChart": "Afficher le graphique",
  "evidence.replay": "Rejouer",
  "evidence.summaryCrossedOne": "{label} a franchi le seuil {days} jour",
  "evidence.summaryCrossedMany": "{label} a franchi le seuil {days} jours",
  "evidence.summaryMissingOne": "{days} relevé manque et n’est pas estimé.",
  "evidence.summaryMissingMany": "{days} relevés manquent et ne sont pas estimés.",
  "evidence.summaryConflictOne": "Les sources divergent sur le franchissement {days} jour.",
  "evidence.summaryConflictMany": "Les sources divergent sur le franchissement {days} jours.",
  "evidence.captionTable":
    "Relevés par source, en {unit}, par rapport à un seuil de {comparator} {threshold} {unit}.",
  "evidence.noData": "Il n’y a pas encore de preuves à tracer pour cette réclamation.",
  "evidence.gapLabel": "manquant",
  "evidence.legend.disagree": "les sources divergent",
  "evidence.col.date": "Date",
  "evidence.col.note": "Note",
  "evidenceTable.col.source": "Source",
  "evidenceTable.col.station": "Station signalée",
  "evidenceTable.col.period": "Période",
  "evidenceTable.col.unit": "Unité",
  "evidenceTable.col.days": "Jours",
  "evidenceTable.col.crossed": "Franchie",
  "evidenceTable.col.status": "Statut",
  "source.identifier": "Identifiant",
  "source.variable": "Variable",
  "source.unit": "Unité",
  "source.attribution": "Attribution",
  "source.quirks": "Particularités connues",
  "source.exampleRequest": "Exemple de requête",
  "startClaim.heading": "Lancer une réclamation",
  "startClaim.periodStart": "Début de la période de la réclamation",
  "startClaim.periodEnd": "Fin de la période de la réclamation",
  "startClaim.retired":
    "Cette policy est retirée : aucune nouvelle réclamation ne peut y être lancée.",
  "wallet.heading": "Portefeuille",
  "wallet.detected": "Portefeuilles détectés",
  "wallet.account": "Compte",
  "wallet.chooseFirst": "Choisissez d’abord un portefeuille ci-dessus.",
  "wallet.closePanel": "Fermer le panneau du portefeuille",
  "wallet.eip6963Title":
    "Trouvé via window.ethereum ; ce portefeuille n’implémente pas EIP-6963.",
  "evidence.caption.claimDetail":
    "Les relevés quotidiens proviennent de la réponse source enregistrée pour ce lieu et cette période (voir fixtures/historical/). Le contrat stocke la valeur agrégée et l’indicateur de franchissement ; le détail quotidien est uniquement affiché.",
  "evidence.caption.demo":
    "Les relevés sont la réponse enregistrée du point d’accès documenté pour ce lieu et cette période. Les jours manquants sont dessinés en hachures et ne sont jamais estimés.",
  "evidence.noSeries":
    "Aucune série quotidienne enregistrée ne soutient encore cette réclamation. Les preuves agrégées évaluées par le contrat figurent dans le tableau ci-dessous.",
  "audit.heading": "Audit",
  "audit.export": "Exporter le reçu (JSON)",
  "audit.exportHint":
    "Télécharge le dossier d’audit complet — politique, preuves, vérifications, décision, litiges et règlement — dans un fichier JSON.",
  "audit.criteriaVersion": "Version des critères",
  "audit.round": "Tour d’évaluation",
  "audit.reasonCode": "Code de motif",
  "audit.finalized": "Finalisée",
  "audit.finalizedYes": "oui",
  "audit.finalizedNo": "non — une décision acceptée reste contestable",
  "audit.claimId": "ID de réclamation",
  "audit.policyId": "ID de policy",
  "audit.contract": "Contrat",
  "audit.network": "Réseau",
  "audit.transaction": "Transaction",
  "audit.contractAddress": "Adresse du contrat",
  "audit.txHash": "Hash de transaction",
  "audit.explorerDown": "Les liens vers l’explorateur sont indisponibles pour le moment",
  "audit.meaningTitle": "Ce que « confirmé » signifie et ne signifie pas",
  "audit.meaning":
    "« Confirmé » signifie que les preuves récupérées par les validateurs respectaient les termes définis par cette policy. Ce n’est pas une détermination juridique, ni une déclaration selon laquelle quelqu’un serait contractuellement tenu de payer. Un paiement n’a lieu qu’une fois la décision finale, et uniquement par la voie du règlement.",
  "timeline.heading": "Progression",
  "timeline.claim": "Chronologie de la réclamation",
  "timeline.disputes": "Historique des contestations",
  "timeline.caption":
    "Chaque tour conserve la décision qu’il a remplacée et les motifs qui l’ont contestée.",
  "timeline.col.round": "Tour",
  "timeline.col.grounds": "Motifs",
  "timeline.col.before": "Décision précédente",
  "timeline.col.after": "Décision suivante",
  "policies.ownerOnlyNote":
    "Réservé au propriétaire : le contrat enregistre les policies depuis son propriétaire.",
  "policies.noRegistryMatch":
    "Aucune entrée du registre ne correspond aux sources de cette policy.",
  "policies.noClaimsYet": "Aucune réclamation pour l’instant sur cette policy.",

  "wallet.connect": "Connecter le portefeuille",
  "wallet.connected": "Connecté",
  "wallet.disconnect": "Déconnecter",
  "wallet.copyAddress": "Copier l’adresse",
  "wallet.switchNetwork": "Changer de réseau",
  "wallet.noneFound": "Aucun portefeuille détecté",
  "wallet.noneFoundBody":
    "Une page web ne peut pas lister les extensions installées : elle ne voit que les portefeuilles qui se déclarent. Installez ou déverrouillez une extension (MetaMask, Rabby, Brave et autres), puis rechargez.",
  "wallet.multiFound":
    "Plusieurs portefeuilles sont installés. Choisissez celui avec lequel cette application parle : sans EIP-6963, le dernier chargé gagnerait silencieusement.",
  "wallet.onUnknownNetwork": "Connectez votre portefeuille à {network} pour continuer.",

  "landing.h1": "Le temps a-t-il vraiment fait cela ?",
  "landing.lede":
    "ClimateClaim confronte des observations météorologiques enregistrées à une policy que vous rédigez en langage clair, et vous montre les relevés qui ont produit la réponse. Quand les preuves sont incomplètes ou que les sources divergent, il le dit au lieu de deviner.",
  "landing.openDemo": "Ouvrir la démo",
  "landing.seeConflict": "Voir le conflit de sources",
  "landing.seeClaims": "Voir des réclamations réelles",
  "landing.disagreement.h": "Un désaccord réel",
  "landing.disagreement.p":
    "Deux réanalyses indépendantes du même lieu, le même jour. L’une indique 1,10 mm, l’autre 2,03 mm. Face à un seuil de 1,50 mm, l’une le franchit et l’autre non. La réponse honnête est inconcluante, et c’est un résultat plutôt qu’une erreur.",
  "landing.whyGenLayer.h": "Pourquoi GenLayer",
  "landing.whyGenLayer.p1":
    "Les preuves météorologiques ne sont pas propres. Une source peut être hors service, ne renvoyer qu’une partie de la période, et deux réanalyses doperand également reconnues peuvent diverger d’un facteur deux. Une policy demande aussi une interprétation : quelle station compte comme « la zone », si une journée exactement au seuil compte, quoi faire quand deux sources divergent.",
  "landing.whyGenLayer.p2":
    "Ici, les validateurs récupèrent les mêmes sources indépendamment et comparent le sens, pas les octets. Quand les preuves ne tranchent réellement pas, le contrat renvoie « inconcluant » au lieu de forcer un oui ou un non.",
  "landing.whyGenLayer.link": "Comment fonctionnent le consensus, l’équivalence et la finalité",
  "landing.wont.h": "Ce qu’il ne fera pas",
  "landing.wont.l1": "Inventer, interpoler ou estimer un relevé manquant.",
  "landing.wont.l2":
    "Confier l’arithmétique du seuil à un modèle de langage : c’est du simple code entier.",
  "landing.wont.l3": "Choisir la source la plus favorable pour faire passer une réclamation.",
  "landing.wont.l4": "Régler un paiement sur une décision simplement acceptée.",
  "landing.wont.l5": "Présenter des données historiques enregistrées comme si elles étaient en direct.",
  "landing.deployed":
    "Déployé sur {address} sur {network} (chaîne {id}). Les seuils et montants de {scaled} sont stockés en entiers mis à l’échelle, jamais en flottants.",

  // --- hero evidence field (three.js) --------------------------------------
  "hero.threshold": "seuil {value} {unit}",
  "hero.drag": "faites glisser pour pivoter",
  "hero.split": "{day} : les sources divergent · faites glisser pour pivoter",
  "hero.sound.off": "pluie : sans son",
  "hero.sound.on": "pluie : avec son",

  "how.h1": "Comment une décision est prise",
  "how.lede":
    "Un leader propose un résultat, plusieurs validateurs le vérifient indépendamment, et le résultat n’est conservé que si assez d’entre eux admettent qu’il signifie la même chose.",
  "how.leader.h": "Leader et validateurs",
  "how.leader.p1":
    "Pour une évaluation, un leader récupère les sources éligibles et produit un résultat structuré : une décision, un motif, cinq états par contrôle et une valeur observée. Cette proposition n’est pas acceptée sur parole. Chaque validateur récupère lui-même les mêmes sources, les évalue selon les règles de la policy, et produit son propre résultat.",
  "how.leader.p2":
    "Le résultat est conservé lorsque les conclusions des validateurs sont équivalentes — c’est-à-dire lorsqu’elles signifient la même chose, même si leur formulation diffère. Un validateur dont le résultat diverge rejette la proposition au lieu de s’y ranger.",
  "how.equiv.h": "Ce qui compte comme la même réponse",
  "how.equiv.p1":
    "Le texte météorologique n’est pas comparé octet par octet. Deux résultats sont considérés équivalents lorsque :",
  "how.equiv.l1": "la décision correspond exactement ;",
  "how.equiv.l2":
    "le motif est le même, ou appartient à un groupe d’équivalence documenté ;",
  "how.equiv.l3":
    "chaque contrôle obligatoire — seuil franchi, période couverte, données complètes — correspond ;",
  "how.equiv.l4":
    "la valeur observée est dans une tolérance documentée et se situe du même côté du seuil que la décision.",
  "how.equiv.p2":
    "Cette dernière condition est une protection délibérée. Un validateur n’acceptera pas un « confirmé » dont ses propres chiffres n’atteignent pas le seuil : les validateurs ne peuvent donc pas s’accorder sur quelque chose de simplement faux. Les unités et fuseaux horaires sont normalisés avant toute comparaison, et l’arithmétique du seuil est du simple code entier — jamais le travail du modèle de langage.",
  "how.inconclusive.h": "Pourquoi « inconcluant » existe",
  "how.inconclusive.p1":
    "Quand les preuves ne tranchent pas, la réponse honnête est qu’elles ne tranchent pas. ClimateClaim renvoie « inconcluant » dans quatre situations distinctes :",
  "how.inconclusive.l1t": "Conflit de sources",
  "how.inconclusive.l1d":
    "deux sources divergent sur le franchissement, et la policy ne définit aucun départage.",
  "how.inconclusive.l2t": "Observations manquantes",
  "how.inconclusive.l2d":
    "la période n’est pas entièrement couverte. Le manque est signalé, jamais comblé.",
  "how.inconclusive.l3t": "Lieu incohérent",
  "how.inconclusive.l3d":
    "la station signalée est plus loin du point de la policy que la tolérance de la policy ne l’autorise.",
  "how.inconclusive.l4t": "Sources injoignables",
  "how.inconclusive.l4d": "rien n’a pu être récupéré ; il n’y avait donc rien à évaluer.",
  "how.inconclusive.p2":
    "C’est un résultat, pas une erreur. C’est aussi l’argument le plus net en faveur de GenLayer : une chaîne déterministe unique lisant une API devrait soit valider soit rejeter la réclamation, sans moyen honnête d’exprimer le manque.",
  "how.finality.h": "Accepté n’est pas final",
  "how.finality.p1":
    "Lorsque les validateurs s’accordent, le résultat est accepté. Il reste contestable. Ce n’est qu’une fois que le réseau le finalise qu’il devient final, et un paiement ne peut alors avoir lieu que ensuite. Cette application affiche ces deux états séparément à tous les niveaux, et le bouton de règlement reste désactivé jusqu’à ce que le contrat lui-même signale la décision comme finale.",
  "how.finality.p2":
    "Une réclamation réglée ne peut être réglée qu’une fois. Le contrat enregistre un état de règlement et le vérifie avant tout transfert : un appel répété ne peut donc pas payer deux fois.",
  "how.datamode.h": "Simulation historique et données en direct",
  "how.datamode.p1":
    "Une réclamation en simulation historique est jugée sur des observations enregistrées. Les valeurs sont fixes ; relancer la réclamation ne les change pas. Une réclamation en direct est jugée sur des données récupérées au moment de l’évaluation, et une nouvelle évaluation peut produire une nouvelle réponse. Chaque écran de policy et de réclamation de cette application porte un badge indiquant lequel des deux il est.",
  "how.datamode.p2":
    "Les preuves affichées dans cette application sont lues depuis le contrat déployé à {address} sur {network} (chaîne {id}). Quand une lecture de la chaîne est impossible, la page le dit et affiche un instantané enregistré plutôt que de présenter des données périmées comme étant en direct.",
  "how.limits.h": "Limites",
  "how.limits.l1":
    "Les sources météorologiques divergent d’un facteur deux le même jour. C’est une réelle dispersion des modèles, pas un bug, et c’est exactement pourquoi les règles d’accord existent.",
  "how.limits.l2":
    "Les sources de réanalyse rapportent la cellule de grille utilisée, qui peut se situer à plusieurs kilomètres du point demandé. Une tolérance de distance serrée produira des résultats inconclusants.",
  "how.limits.l3":
    "Le point d’accès public StudioNet autorise un nombre limité de lectures par heure : les lectures sont espacées et dédupliquées.",
  "how.limits.l4ok":
    "Les réclamations sur les réseaux de test publics ne sont pas réglées en valeur réelle.",
  "how.limits.l4down":
    "L’explorateur StudioNet est en pause : les liens de transaction sont affichés comme indisponibles plutôt que comme des liens morts.",

  "claims.h1": "Réclamations",
  "claims.lede":
    "Toutes les réclamations ci-dessous existent sur le contrat déployé à {address} sur {network}.",
  "claims.empty":
    "Aucune réclamation pour l’instant. Lancez-en une depuis une policy sur la page des policies.",
  "claims.emptyLink": "page des policies",
  "claims.caption.one": "{count} réclamation lue depuis la chaîne{suffix}.",
  "claims.caption.many": "{count} réclamations lues depuis la chaîne{suffix}.",
  "claims.captionSnapshot": " (instantané enregistré)",
  "claims.col.claim": "Réclamation",
  "claims.col.policy": "Policy",
  "claims.col.state": "État",
  "claims.col.decision": "Décision",
  "claims.col.round": "Tour",
  "claims.col.final": "Final",
  "claims.evalFailed": "L’évaluation ne s’est pas terminée",
  "claims.footer":
    "Le mode démo rejoue huit scénarios documentés, dont certains sans réclamation sur la chaîne.",

  "policies.h1": "Policies",
  "policies.lede":
    "Une policy fixe le lieu, la période, le seuil, la règle d’agrégation et les sources éligibles. Dès qu’une réclamation la référence, elle ne peut plus changer.",
  "policies.empty": "Aucune policy pour l’instant. Ouvrez la démo pour voir ce qu’une policy produit.",
  "policies.caption": "{count} policies sur le contrat déployé.",
  "policies.col.policy": "Policy",
  "policies.col.location": "Lieu",
  "policies.col.condition": "Condition",
  "policies.col.dataMode": "Mode de données",
  "policies.col.status": "Statut",
  "policies.new": "Créer une policy",
  "policies.openList": "Ouvrir la liste des policies",
  "policies.notFound.h": "Policy introuvable",
  "policies.notFound.title": "Aucune policy nommée « {id} »",
  "policies.notFound.body":
    "Elle a peut-être été supprimée, ou l’adresse provient d’un autre déploiement.",
  "policies.detail.h": "Policy {id}",
  "policies.detail.locked":
    "Cette policy est référencée par une réclamation : elle ne peut plus être modifiée.",
  "policies.detail.lockedBody":
    "L’immuabilité après le premier usage est ce qui rend une décision auditable plus tard : les termes selon lesquels un validateur a jugé ne peuvent pas dériver.",
  "policies.terms.h": "Termes",
  "policies.terms.condition": "Condition",
  "policies.terms.location": "Lieu",
  "policies.terms.tolerance": "Tolérance de distance",
  "policies.terms.period": "Période d’observation",
  "policies.terms.metric": "Métrique",
  "policies.terms.aggregation": "Agrégation",
  "policies.terms.sources": "Sources éligibles",
  "policies.terms.agreement": "Règle d’accord",
  "policies.terms.minSources": "Sources minimum",
  "policies.terms.payout": "Paiement",
  "policies.terms.beneficiary": "Bénéficiaire",
  "policies.sources.h": "Sources éligibles",
  "policies.claims.h": "Réclamations sur cette policy",
  "policies.startHere": "Lancer une réclamation",

  "policyNew.h1": "Créer une policy",
  "policyNew.lede":
    "Une policy fixe à l’avance le lieu, la période, le seuil, la règle d’agrégation et les sources éligibles. Dès qu’une réclamation la référence, elle ne pourra plus jamais changer : c’est ce qui rend une décision ultérieure auditable.",
  "policyNew.ownerOnly": "Cette écriture est réservée au propriétaire",
  "policyNew.ownerOnlyBody": "Seul le propriétaire du contrat peut créer une policy.",
  "policyNew.wrongNetwork": "Mauvais réseau",
  "policyNew.terms.h": "Termes",
  "policyNew.f.location": "Nom du lieu",
  "policyNew.f.lat": "Latitude (degrés)",
  "policyNew.f.lon": "Longitude (degrés)",
  "policyNew.f.tolerance": "Tolérance de distance (mètres)",
  "policyNew.f.toleranceHelp":
    "De combien la station ou la cellule d’une observation peut s’éloigner des coordonnées et compter quand même.",
  "policyNew.f.timezone": "Fuseau horaire",
  "policyNew.f.timezoneHelp":
    "Les fenêtres d’observation sont des jours civils UTC ; le contrat rejette toute autre valeur.",
  "policyNew.f.metric": "Métrique",
  "policyNew.f.metricHelp":
    "L’unité suit la métrique : le contrat n’accepte que l’unité canonique.",
  "policyNew.f.periodStart": "Début de la période d’observation",
  "policyNew.f.periodEnd": "Fin de la période d’observation",
  "policyNew.f.comparator": "Comparaison du seuil",
  "policyNew.f.threshold": "Seuil",
  "policyNew.f.thresholdHelp": "Stocké en entier ×100 — jamais en flottant.",
  "policyNew.f.aggregation": "Règle d’agrégation",
  "policyNew.f.agreement": "Règle d’accord entre sources",
  "policyNew.f.minSources": "Nombre minimum de sources d’accord",
  "policyNew.f.payout": "Paiement (unités de base)",
  "policyNew.f.dataMode": "Mode de données",
  "policyNew.f.dataModeHelp":
    "Le contrat n’ensemence aucune source : le registre ne contient que ce que le propriétaire enregistre.",
  "policyNew.mode.historical": "Simulation historique",
  "policyNew.mode.historicalHelp":
    "Observations historiques enregistrées, pas un flux en direct. La période doit être entièrement passée ; relancer la réclamation ne peut pas changer les données sous-jacentes.",
  "policyNew.mode.live": "En direct",
  "policyNew.mode.liveHelp":
    "Les valeurs sont récupérées depuis la source au moment de l’évaluation. Le résultat reflète le monde maintenant et peut varier d’une évaluation à l’autre.",
  "policyNew.f.condition": "Condition, en mots clairs",
  "policyNew.f.conditionHelp":
    "Rempli à partir du résumé ci-dessous jusqu’à ce que vous le modifiiez. Stocké sur la chaîne comme forme lisible de la policy.",
  "policyNew.confirm.h": "Confirmez la phrase",
  "policyNew.confirm.help":
    "C’est ce que les validateurs liront. Vérifiez que cela dit ce que vous voulez : une faute de frappe ici devient un terme de la policy.",
  "policyNew.submit": "Créer la policy",
  "policyNew.cancel": "Annuler",
  "policyNew.clearDraft": "Effacer le formulaire",
  "policyNew.draftRestored":
    "Brouillon restauré depuis votre dernière visite sur cet appareil.",
  "policyNew.submitting": "Création",
  "policyNew.validation": "Corrigez d’abord les champs signalés.",

  "claimDetail.notFound.h": "Réclamation introuvable",
  "claimDetail.notFound.title": "Aucune réclamation nommée « {id} »",
  "claimDetail.notFound.body":
    "Elle a peut-être été supprimée, ou l’adresse provient d’un autre déploiement.",
  "claimDetail.h1": "Réclamation {id}",
  "claimDetail.evidence": "Preuves",
  "claimDetail.checks": "Contrôles",
  "claimDetail.actions": "Actions",
  "claimDetail.noWallet": "Aucun portefeuille détecté",
  "claimDetail.noWalletBody":
    "La lecture des réclamations est ouverte à tous. L’envoi d’une transaction nécessite un portefeuille de navigateur.",
  "claimDetail.wrongNetwork": "Mauvais réseau",
  "claimDetail.startEvaluation": "Lancer l’évaluation",
  "claimDetail.finalize": "Finaliser la décision",
  "claimDetail.finalizeHelp":
    "Relit la décision à la finalité ; refuse si elle a changé. Propriétaire uniquement.",
  "claimDetail.reevaluate": "Ré-évaluer",
  "claimDetail.reevaluateHelp":
    "Lance un nouveau tour d’évaluation. Les motifs ouverts sont conservés dans l’historique.",
  "claimDetail.dispute.open": "Contestation ouverte",
  "claimDetail.dispute.title": "Contester",
  "claimDetail.dispute.grounds": "Motifs de la contestation",
  "claimDetail.dispute.placeholder":
    "Pourquoi cette décision devrait-elle être contestée ? Citez la source, la station ou la période d’observation que vous jugez mal évaluée.",
  "claimDetail.dispute.help":
    "Le contrat stocke ce texte avec la contestation et exige qu’il ne soit pas vide, avec au moins 10 caractères.",
  "claimDetail.dispute.submit": "Ouvrir la contestation",
  "claimDetail.dispute.helpIntro":
    "Ces motifs sont stockés sur la chaîne et rejoignent l’historique des contestations une fois celle-ci ouverte.",
  "claimDetail.settle.h": "Règlement",
  "claimDetail.settle.none":
    "Cette policy n’a pas de montant de paiement ; il n’y a donc rien à régler.",
  "claimDetail.settle.gate":
    "L’émission du paiement n’est possible qu’une fois la décision finale. Une décision acceptée reste contestable.",
  "claimDetail.settle.ownerOnly": "Propriétaire uniquement.",
  "claimDetail.settle.emit": "Émettre le paiement",
  "claimDetail.settle.emitted": "Paiement émis — livraison pas encore vérifiée",
  "claimDetail.settle.emittedFull":
    "Le message de paiement est parti : la réclamation n’est donc pas encore réglée. Sur GenLayer, la valeur quitte ce contrat immédiatement, mais n’atteint le bénéficiaire que lorsque la transaction enfant du message est activée, et cette transaction peut encore échouer. Confirmez-la dans le contrat pour enregistrer le résultat. Ne déduisez jamais la livraison du solde du bénéficiaire.",
  "claimDetail.settle.markFailed": "Marquer le paiement comme échoué (réessayable)",
  "claimDetail.settle.failed":
    "La dernière tentative de paiement a échoué : rien n’a été payé. La réclamation peut être réessayée ; émettez à nouveau le paiement une fois la cause corrigée.",
  "claimDetail.timeline.h": "Progression",
  "claimDetail.copySummary": "Copier le résumé",
  "claimDetail.disputes.h": "Contestations",

  "demo.h1": "Mode démo",
  "demo.lede":
    "Huit scénarios couvrant les issues qu’une vraie réclamation peut atteindre. Chacun indique ce qu’il teste, montre les relevés sur lesquels il a été décidé, et porte une étiquette indiquant l’origine des données.",
  "demo.whatItTests": "Ce que cela teste :",
  "demo.rejected": "Cette tentative est rejetée",
  "demo.rejectedBody":
    "Aucune décision, car aucune réclamation n’a été créée. La tentative ci-dessus a été rejetée.",
  "demo.decision": "Décision",
  "demo.checks": "Contrôles enregistrés sur la chaîne",
  "demo.scenarios": "Scénarios",
  "demo.howToRead": "Comment lire ceci",
  "demo.howToReadBody":
    "Chaque scénario montre la décision, les états par contrôle, l’enregistrement d’audit et le cycle de vie de la transaction.",
  "demo.whereNumbers": "D’où viennent les chiffres",
  "demo.whereNumbersBody":
    "Les relevés sont une réponse source réelle enregistrée, et le résultat affiché est celui que produisent les règles d’évaluation du contrat pour ces données. Ce n’est pas une transaction et n’est jamais présenté comme telle.",
  "demo.whereNumbersBody2":
    "Les relevés proviennent des points d’accès documentés, ou d’une réponse enregistrée capturée depuis des points d’accès en direct. Aucune valeur météorologique de cette démo n’a été inventée.",
  "demo.startClaim": "Lancer une réclamation",
  "demo.evaluate": "Évaluer",
  "demo.badgeLive": "{id} lue depuis la chaîne",
  "demo.badgeReplay": "résultat produit par les règles du contrat",
  "demo.provenance.onChain": "sur la chaîne",
  "demo.provenance.replay": "rejeu",
  "demo.provenance.onChainBody":
    "signifie que la décision affichée est lue depuis le contrat déployé à {address}. Ouvrez-la pour voir les preuves réelles, les contrôles, l’enregistrement d’audit et le cycle de vie de la transaction.",
  "demo.provenance.replayBody":
    "signifie que les relevés quotidiens sont une réponse source réelle enregistrée, et que le résultat affiché est celui que produisent les règles d’évaluation du contrat pour ces données. Ce n’est pas une transaction et n’est jamais présenté comme telle.",
  "demo.pinnedBy": "Le résultat de chaque scénario est fixé par un test direct :",
  "demo.fixtures":
    "Tous les relevés enregistrés se trouvent dans fixtures/historical/ et ont été revérifiés contre les points d’accès en direct. Aucune valeur météorologique de cette démo n’a été inventée.",
  "demo.network": "Réseau : {network} (chaîne {id}).",
  "demo.explorerLive": "Les liens vers l’explorateur sont actifs.",
  "demo.explorerDown": "L’explorateur est en pause ; les liens sont désactivés.",

  // --- claims filtering and pagination -------------------------------------
  "claims.filter.h": "Filtrer et rechercher",
  "claims.filter.search": "Id de réclamation ou de police",
  "claims.filter.decision": "Décision",
  "claims.filter.state": "État",
  "claims.filter.all": "Toutes",
  "claims.filter.pending": "Non décidée",
  "claims.filter.clear": "Effacer les filtres",
  "claims.filter.none": "Aucune réclamation ne correspond à ces filtres.",
  "claims.filter.showing": "{shown} réclamations sur {total} affichées.",
  "claims.pagination.prev": "Précédent",
  "claims.pagination.next": "Suivant",
  "claims.pagination.page": "Page {page} sur {pages}",

  // --- policy form: honest loading/empty/incomplete states -----------------
  "policyNew.sources.loading": "Chargement du registre des sources…",
  "policyNew.sources.emptyH": "Aucune source ne mesure {metric}",
  "policyNew.sources.empty": "Le contrat ne peut pas créer de police sans source enregistrée, et aucune ne mesure {metric} : le registre était illisible ou réellement vide. Relancez la lecture, ou demandez au propriétaire d’en enregistrer une avec register_source.",
  "policyNew.sources.recorded": "Affichage de l’instantané enregistré du registre ; la lecture en direct a échoué ({error}).",
  "policyNew.confirm.incomplete": "Il manque encore : {fields}",
  "policyNew.missing.location": "le nom du lieu",
  "policyNew.missing.dates": "les dates d’observation",
  "policyNew.missing.threshold": "le seuil",
  "policyNew.missing.sources": "au moins une source",

  // --- evidence comparison --------------------------------------------------
  "compare.h": "Comparaison des sources jour par jour",
  "compare.caption": "La lecture de chaque source pour chaque jour de la période, en {unit}. L’écart est la lecture la plus haute du jour moins la plus basse.",
  "compare.col.spread": "Écart",
  "compare.col.verdict": "Ce jour-là",
  "compare.verdict.split": "les sources divergent sur le franchissement",
  "compare.verdict.both": "les deux franchissent",
  "compare.verdict.neither": "aucune ne franchit",
  "compare.verdict.single": "une seule source",
  "compare.noReadings": "aucune lecture",
  "compare.missing": "pas de lecture",
  "compare.incomplete": "jour incomplet",
  "compare.summaryOne": "Les sources divergent sur le seuil le {days}.",
  "compare.summaryNone": "Chaque jour, les sources disposant de lectures s’accordent sur le seuil.",

  // --- the deterministic-chain contrast ------------------------------------
  "contrast.h": "Ce qu’une chaîne déterministe aurait répondu",
  "contrast.badge": "expérience de pensée",
  "contrast.intro": "Un contrat qui lit une seule source figée ne peut pas exprimer le doute : il doit répondre oui ou non. Voici la réponse que chaque source imposerait à elle seule, calculée à partir des mêmes relevés enregistrés.",
  "contrast.sourceCard": "Si le contrat ne lisait que {label}",
  "contrast.verdictConfirmed": "Condition confirmée — paiement",
  "contrast.verdictNotConfirmed": "Condition non confirmée — pas de paiement",
  "contrast.observed": "Observé : {value} {unit}",
  "contrast.genlayerCard": "Ce que le contrat déployé a réellement renvoyé",
  "contrast.genlayerVerdict": "Non concluant — conflit de sources",
  "contrast.genlayerBody": "Les mêmes relevés, jugés honnêtement : les sources divergent sur le franchissement et la police ne définit aucune règle de départage ; les preuves ne tranchent donc pas la question. Aucun paiement n’est forcé dans un sens ou dans l’autre.",
  "contrast.footnote": "Pas un résultat de chaîne. Les réponses de gauche sont une hypothèse, calculée localement à partir des mêmes relevés enregistrés par la règle de comparaison de la police ; la réponse de droite est ce que produisent les règles d’évaluation du contrat, figée par un test direct.",

  // --- chart accessibility --------------------------------------------------
  "evidence.chartAriaOne": "Graphique de preuves avec une source sur {days} jours.",
  "evidence.chartAriaMany": "Graphique de preuves avec {sources} sources sur {days} jours.",
  "evidence.pointPass": "{source} — {date} : {value} {unit}, franchit le seuil",
  "evidence.pointFail": "{source} — {date} : {value} {unit}, ne franchit pas le seuil",

  // --- error boundary -------------------------------------------------------
  "errorBoundary.h": "Cet écran a cessé de fonctionner",
  "errorBoundary.body": "Un problème inattendu a interrompu cette page. Le reste de l’application fonctionne : réessayez, ou revenez à l’accueil.",
  "errorBoundary.home": "Aller à la page d’accueil",

  // --- print receipt --------------------------------------------------------
  "audit.print": "Imprimer le reçu",
  "audit.printHint": "Imprimez cette page ou enregistrez-la en PDF. La mise en page d’impression ne conserve que le dossier de réclamation.",
  "audit.printNote": "Imprimé {date} · contrat {address} · {network}",
};