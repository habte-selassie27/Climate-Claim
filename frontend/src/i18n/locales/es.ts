import type { Dictionary } from "../index";

/** Spanish. Every key in `en` must be present; a gap is a compile error. */
export const es: Dictionary = {
  "common.yes": "sí",
  "common.no": "no",
  "common.details": "Detalles",
  "common.loading": "Cargando",
  "common.retry": "Intentar de nuevo",
  "common.chain": "cadena {id}",
  "common.optional": "opcional",
  "common.dash": "—",
  "common.unknown": "Desconocido",
  "common.notEvaluated": "sin evaluar",

  "nav.main": "Principal",
  "nav.home": "Inicio",
  "nav.demo": "Demo",
  "nav.claims": "Reclamaciones",
  "nav.policies": "Pólizas",
  "nav.howItWorks": "Cómo funciona",
  "nav.skipToMain": "Saltar al contenido principal",
  "nav.notFound.h": "Página no encontrada",
  "flow.leader": "El líder obtiene las fuentes elegibles y propone un resultado",
  "flow.validators": "Los validadores obtienen las mismas fuentes y evalúan de forma independiente",
  "flow.equivalent": "¿Son equivalentes los resultados?",
  "flow.accepted": "Aceptado: todavía puede impugnarse",
  "flow.rejected": "Propuesta rechazada",
  "flow.appealed": "¿Impugnado?",
  "flow.finalised": "Finalizada",
  "flow.settled": "Liquidada: se paga una sola vez",
  "flow.yes": "sí",
  "flow.no": "no",
  "flow.arrowTo": "luego",
  "flow.caption":
    "Cómo se alcanza una decisión: un líder propone, los validadores evalúan de forma independiente, el resultado solo se conserva si coinciden en que significa lo mismo, y solo una decisión final puede liquidarse.",
  "nav.notFound.body": "Esa dirección no corresponde a ninguna página de esta aplicación.",
  "nav.wrongNetwork": "Red incorrecta ({id})",
  "footer.tagline": "Reclamaciones paramétricas meteorológicas basadas en evidencia en GenLayer.",
  "footer.contract": "Contrato {address}",
  "footer.explorer": "Explorador",
  "footer.explorerPaused": "Explorador actualmente en pausa",
  "footer.demoMode": "Modo demo",

  "theme.label": "Tema",
  "theme.system": "Sistema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.useSystem": "Usar el tema del sistema",
  "theme.useLight": "Usar el tema claro",
  "theme.useDark": "Usar el tema oscuro",

  "lang.label": "Idioma",
  "lang.change": "Cambiar de idioma",

  "decision.eyebrow": "Decisión",
  "decision.confirmed.label": "Condición confirmada",
  "decision.confirmed.sentence": "Las pruebas registradas cumplieron los términos de esta póliza.",
  "decision.notConfirmed.label": "Condición no confirmada",
  "decision.notConfirmed.sentence":
    "Las pruebas registradas no cumplieron los términos de esta póliza.",
  "decision.inconclusive.label": "Inconcluyente",
  "decision.inconclusive.sentence":
    "Las pruebas no resuelven la cuestión en ningún sentido. Esto es un resultado, no un error.",
  "decision.none.label": "Aún sin evaluar",
  "decision.none.sentence": "Esta reclamación aún no tiene decisión.",
  "decision.validatorWords": "En palabras del validador:",
  "decision.evalFailed": "Esta evaluación no se completó",
  "decision.errorDetail":
    "La cadena de error estable del contrato es {code}. Reintentar suele funcionar cuando la fuente no estaba disponible temporalmente.",
  "decision.claimState": "Estado de la reclamación",
  "decision.highestReading": "Lectura más alta",
  "decision.threshold": "Umbral",
  "decision.period": "Periodo de observación",
  "decision.round": "Ronda de evaluación",

  "reason.thresholdCrossed":
    "Al menos una lectura del periodo de observación alcanzó el umbral de la póliza.",
  "reason.thresholdNotCrossed":
    "Ninguna lectura del periodo de observación alcanzó el umbral de la póliza.",
  "reason.sourceConflict":
    "Las fuentes elegibles discreparon sobre si se superó el umbral, y la póliza no define un desempate.",
  "reason.sourceConflict.resolve":
    "Impugna la decisión con un motivo si crees que una fuente debería tener prioridad.",
  "reason.missingObservations":
    "Las pruebas no cubren todo el periodo de observación, así que no puede juzgarse el umbral.",
  "reason.missingObservations.resolve":
    "Reintenta la evaluación más tarde, o impugna con una fuente que sí cubra el periodo.",
  "reason.locationMismatch":
    "La estación comunicada está fuera de la distancia que esta póliza permite respecto a la ubicación indicada.",
  "reason.locationMismatch.resolve":
    "Impugna si crees que la estación es en realidad la ubicación correcta.",
  "reason.sourcesUnreachable":
    "No se pudo contactar con ninguna de las fuentes elegibles, así que no había nada que evaluar.",
  "reason.sourcesUnreachable.resolve":
    "Reintenta la evaluación: esto suele ser temporal.",
  "reason.none": "Todavía no se ha registrado ningún motivo.",

  "check.thresholdCrossed.label": "Umbral superado",
  "check.thresholdCrossed.blurb": "Si alguna lectura alcanzó el umbral de la póliza.",
  "check.periodCovered.label": "Periodo cubierto",
  "check.periodCovered.blurb": "Si las pruebas abarcan todo el periodo de observación.",
  "check.locationMatch.label": "Coincidencia de ubicación",
  "check.locationMatch.blurb": "Si la estación comunicada coincide con la ubicación de la póliza.",
  "check.sourceAgreement.label": "Acuerdo entre fuentes",
  "check.sourceAgreement.blurb": "Si las fuentes elegibles coincidieron entre sí.",
  "check.dataCompleteness.label": "Completitud de los datos",
  "check.dataCompleteness.blurb": "Si falta alguna observación del periodo.",
  "check.status.pass": "Correcta",
  "check.status.fail": "Fallo",
  "check.status.unclear": "Incierto",
  "check.required": "obligatorio",
  "check.supporting": "de apoyo",
  "check.none": "No se registró ninguna comprobación para esta reclamación.",

  "state.created.label": "Creada",
  "state.created.blurb": "La reclamación existe. Aún no se ha solicitado evidencia.",
  "state.pendingEvaluation.label": "Evaluando",
  "state.pendingEvaluation.blurb":
    "Los validadores están obteniendo la evidencia y comparando resultados.",
  "state.evidenceCollected.label": "Evidencia recopilada",
  "state.evidenceCollected.blurb":
    "Se obtuvieron las observaciones. Todavía no se ha alcanzado ninguna decisión.",
  "state.decidedConfirmed.label": "Decisión: confirmada",
  "state.decidedConfirmed.blurb":
    "Se ha alcanzado una decisión y los validadores la han aceptado.",
  "state.decidedNotConfirmed.label": "Decisión: no confirmada",
  "state.decidedNotConfirmed.blurb":
    "Se ha alcanzado una decisión y los validadores la han aceptado.",
  "state.inconclusive.label": "Decisión: inconcluyente",
  "state.inconclusive.blurb":
    "Se ha alcanzado una decisión: las pruebas no resuelven la cuestión.",
  "state.disputed.label": "Impugnada",
  "state.disputed.blurb": "La decisión se está cuestionando y volverá a evaluarse.",
  "state.settled.label": "Liquidada",
  "state.settled.blurb": "Se ha efectuado el pago de esta reclamación.",
  "state.unknown.label": "Desconocido",
  "state.unknown.blurb": "Este estado no se reconoce.",

  "settlement.notSettled": "Sin liquidar",
  "settlement.payoutEmitted": "Pago emitido: entrega aún no verificada",
  "settlement.settled": "Liquidada",
  "settlement.failed": "Pago fallido: se puede reintentar",
  "settlement.unknown": "Desconocido",

  "datamode.live.label": "En vivo",
  "datamode.live.blurb":
    "Los valores se obtienen de la fuente en el momento de la evaluación. El resultado refleja el mundo ahora, y puede cambiar si vuelves a evaluar.",
  "datamode.historical.label": "Simulación histórica",
  "datamode.historical.blurb":
    "Los valores provienen de observaciones archivadas de una ventana completamente pasada, no de un feed en vivo. El contrato vuelve a obtener el archivo cada vez que se evalúa una reclamación, así que se reflejaría que un proveedor revisara su propia historia: no es un conjunto de datos congelado.",
  "datamode.recorded": "· registrado",
  "datamode.mixed": "· mixto",
  "datamode.recordedTitle": "Leído de una instantánea capturada, no de la cadena en vivo.",
  "datamode.mixedTitle":
    "Parte de esto se leyó en vivo; parte proviene de la instantánea capturada.",

  "origin.live": "En vivo desde {network}",
  "origin.liveTitle": "Leído en vivo desde {network}.",
  "origin.mixed": "Mixto: en vivo y registrado",
  "origin.mixedTitle":
    "Parte de esto se leyó en vivo desde {network}; parte proviene de la instantánea capturada el {captured}.",
  "origin.checking": "Instantánea registrada · comprobando {network}",
  "origin.checkingTitle":
    "Se muestra la instantánea capturada el {captured} mientras se completa la lectura en vivo.",
  "origin.recorded": "Instantánea registrada",
  "origin.recordedTitle": "Instantánea registrada en cadena capturada el {captured}.",
  "origin.recordedUnreachable": " (red inaccesible)",
  "origin.unreachable": " No se pudo contactar con la red ({error}).",
  "origin.networkDefault": "la red",

  "tx.idle": "Aún no enviado",
  "tx.submitted": "Enviado a la red",
  "tx.pending": "Los validadores están evaluando",
  "tx.accepted": "Aceptado: todavía puede impugnarse",
  "tx.finalized": "Final",
  "tx.failed": "No se completó",
  "tx.hint.submitted": "Esperando a que la red lo recoja.",
  "tx.hint.pending":
    "Esto puede tardar. Los validadores obtienen las fuentes de forma independiente.",
  "tx.hint.accepted":
    "Los validadores coincidieron. El resultado no es permanente hasta que sea final.",
  "tx.hint.finalized": "Este resultado es permanente.",
  "tx.hint.failed": "No cambió nada en la cadena.",
  "tx.refresh": "Actualizar estado",
  "tx.final.final": "Final",
  "tx.final.accepted": "Aceptado: todavía puede impugnarse",
  "tx.final.notYet": "Aún no es final",

  "error.empty": "Algo no se completó.",
  "error.expected": "Esa solicitud no está permitida.",
  "error.external":
    "No se pudo contactar con una fuente de datos, así que no había nada que evaluar.",
  "error.transient": "Hubo un problema temporal en la red.",
  "error.llm": "No se pudo completar la evaluación.",
  "error.generic": "No se pudo completar esa acción.",

  "agg.maxSingle": "la lectura individual más alta de cualquier día",
  "agg.cumulative": "el total de todo el periodo",
  "agg.consecutiveDays": "la racha más larga de días consecutivos",
  "cmp.gt": "mayor que",
  "cmp.gte": "al menos",
  "cmp.lt": "menor que",
  "cmp.lte": "como máximo",
  "policy.sentence":
    "Se confirma si {aggregation} en {location} es {comparator} {threshold} {unit} cualquier día entre {start} y {end}, usando {sources}.",
  "policy.sources.none": "ninguna fuente",
  "policy.sources.two": "{first} y {last}",

  "copy.copy": "Copiar",
  "copy.copied": "Copiado",
  "copy.viewOnExplorer": "Ver en el explorador",
  "copy.explorerUnavailable": "Enlace al explorador no disponible",
  "copy.explorerNoteDefault": "El explorador no está disponible actualmente.",
  "evidence.chart": "Gráfico de evidencia",
  "evidence.showTable": "Ver como tabla",
  "evidence.showChart": "Ver gráfico",
  "evidence.summaryCrossedOne": "{label} superó el umbral {days} día",
  "evidence.summaryCrossedMany": "{label} superó el umbral {days} días",
  "evidence.summaryMissingOne": "Falta {days} lectura y no se estima.",
  "evidence.summaryMissingMany": "Faltan {days} lecturas y no se estiman.",
  "evidence.summaryConflictOne": "Las fuentes discrepan sobre el cruce {days} día.",
  "evidence.summaryConflictMany": "Las fuentes discrepan sobre el cruce {days} días.",
  "evidence.captionTable":
    "Lecturas por fuente, en {unit}, frente a un umbral de {comparator} {threshold} {unit}.",
  "evidence.noData": "Todavía no hay evidencia que representar para esta reclamación.",
  "evidence.gapLabel": "faltante",
  "evidence.legend.disagree": "las fuentes discrepan",
  "evidence.col.date": "Fecha",
  "evidence.col.note": "Nota",
  "evidenceTable.col.source": "Fuente",
  "evidenceTable.col.station": "Estación comunicada",
  "evidenceTable.col.period": "Periodo",
  "evidenceTable.col.unit": "Unidad",
  "evidenceTable.col.days": "Días",
  "evidenceTable.col.crossed": "Superado",
  "evidenceTable.col.status": "Estado",
  "source.identifier": "Identificador",
  "source.variable": "Variable",
  "source.unit": "Unidad",
  "source.attribution": "Atribución",
  "source.quirks": "Peculiaridades conocidas",
  "source.exampleRequest": "Ejemplo de petición",
  "startClaim.heading": "Iniciar una reclamación",
  "startClaim.periodStart": "Inicio del periodo de la reclamación",
  "startClaim.periodEnd": "Fin del periodo de la reclamación",
  "startClaim.retired": "Esta póliza está retirada, así que no se pueden iniciar nuevas reclamaciones sobre ella.",
  "wallet.heading": "Cartera",
  "wallet.detected": "Carteras detectadas",
  "wallet.account": "Cuenta",
  "wallet.chooseFirst": "Elige primero una cartera arriba.",
  "wallet.closePanel": "Cerrar el panel de cartera",
  "wallet.eip6963Title":
    "Encontrada mediante window.ethereum; esta cartera no implementa EIP-6963.",
  "evidence.caption.claimDetail":
    "Las lecturas diarias proceden de la respuesta registrada de la fuente para esta ubicación y periodo (véase fixtures/historical/). El contrato almacena el valor agregado y la marca de cruce; el detalle diario es solo para mostrar.",
  "evidence.caption.demo":
    "Las lecturas son la respuesta registrada del endpoint documentado para esta ubicación y periodo. Los días ausentes se dibujan como huecos rayados y nunca se estiman.",
  "evidence.noSeries":
    "Todavía no hay una serie diaria registrada que respalde esta reclamación. La evidencia agregada que evaluó el contrato está en la tabla de evidencia de abajo.",
  "audit.heading": "Auditoría",
  "audit.export": "Exportar recibo (JSON)",
  "audit.exportHint":
    "Descarga el registro de auditoría completo — la política, la evidencia, las comprobaciones, la decisión, las disputas y la liquidación — como archivo JSON.",
  "audit.criteriaVersion": "Versión de criterios",
  "audit.round": "Ronda de evaluación",
  "audit.reasonCode": "Código de motivo",
  "audit.finalized": "Finalizado",
  "audit.finalizedYes": "sí",
  "audit.finalizedNo": "no: una decisión aceptada todavía puede impugnarse",
  "audit.claimId": "ID de reclamación",
  "audit.policyId": "ID de póliza",
  "audit.contract": "Contrato",
  "audit.network": "Red",
  "audit.transaction": "Transacción",
  "audit.contractAddress": "Dirección del contrato",
  "audit.txHash": "Hash de transacción",
  "audit.explorerDown": "Los enlaces al explorador no están disponibles ahora mismo",
  "audit.meaningTitle": "Qué significa «confirmado» y qué no",
  "audit.meaning":
    "«Confirmado» significa que las pruebas que obtuvieron los validadores cumplieron los términos que definió esta póliza. No es una determinación legal ni una afirmación de que alguien esté obligado contractualmente a pagar. Un pago solo ocurre una vez que la decisión es final, y solo por la vía de liquidación.",
  "timeline.heading": "Progreso",
  "timeline.claim": "Cronología de la reclamación",
  "timeline.disputes": "Historial de impugnaciones",
  "timeline.caption":
    "Cada ronda conserva la decisión a la que sustituyó y los motivos que la cuestionaron.",
  "timeline.col.round": "Ronda",
  "timeline.col.grounds": "Motivos",
  "timeline.col.before": "Decisión anterior",
  "timeline.col.after": "Decisión posterior",
  "policies.ownerOnlyNote":
    "Solo el propietario: el contrato registra políticas desde su propietario.",
  "policies.noRegistryMatch":
    "Ninguna entrada del registro coincidió con las fuentes de esta póliza.",
  "policies.noClaimsYet": "Aún no hay reclamaciones en esta póliza.",

  "wallet.connect": "Conectar cartera",
  "wallet.connected": "Conectada",
  "wallet.disconnect": "Desconectar",
  "wallet.copyAddress": "Copiar dirección",
  "wallet.switchNetwork": "Cambiar de red",
  "wallet.noneFound": "No se encontró cartera inyectada",
  "wallet.noneFoundBody":
    "Una página web no puede listar extensiones instaladas: solo puede ver carteras que se anuncian. Instala o desbloquea una extensión de cartera (MetaMask, Rabby, Brave y otras) y recarga.",
  "wallet.multiFound":
    "Hay más de una cartera instalada. Elige con cuál habla esta aplicación: sin EIP-6963, ganaría silenciosamente la que se cargara al final.",
  "wallet.onUnknownNetwork": "Conecta tu cartera a {network} para continuar.",

  "landing.h1": "¿Hizo el tiempo realmente eso?",
  "landing.lede":
    "ClimateClaim contrasta observaciones meteorológicas registradas con una póliza que escribes en lenguaje claro, y te muestra las lecturas que produjeron la respuesta. Cuando la evidencia está incompleta o las fuentes discrepan, lo dice en lugar de adivinar.",
  "landing.openDemo": "Abrir la demo",
  "landing.seeConflict": "Ver el conflicto de fuentes",
  "landing.seeClaims": "Ver reclamaciones reales",
  "landing.disagreement.h": "Un desacuerdo real",
  "landing.disagreement.p":
    "Dos reanálisis independientes del mismo lugar y el mismo día. Uno dice 1,10 mm y el otro 2,03 mm. Frente a un umbral de 1,50 mm, uno lo supera y el otro no. La respuesta honesta es inconcluyente, y eso es un resultado, no un error.",
  "landing.whyGenLayer.h": "Por qué GenLayer",
  "landing.whyGenLayer.p1":
    "La evidencia meteorológica no es limpia. Una fuente puede estar caída, puede devolver solo parte del periodo, y dos reanálisis igual de reputados pueden discrepar en un factor de dos. Una póliza también requiere interpretación: qué estación cuenta como «la zona», si cuenta un día justo en el umbral, qué hacer cuando dos fuentes discrepan.",
  "landing.whyGenLayer.p2":
    "Aquí los validadores obtienen las mismas fuentes de forma independiente y comparan el significado, no los bytes. Cuando la evidencia realmente no resuelve la cuestión, el contrato devuelve «inconcluyente» en lugar de forzar un sí o un no.",
  "landing.whyGenLayer.link": "Cómo funcionan el consenso, la equivalencia y la finalidad",
  "landing.wont.h": "Lo que no hará",
  "landing.wont.l1": "Inventar, interpolar o estimar una lectura ausente.",
  "landing.wont.l2":
    "Dejar que un modelo de lenguaje haga la aritmética del umbral: eso es código entero simple.",
  "landing.wont.l3": "Elegir la fuente más favorable para que una reclamación pase.",
  "landing.wont.l4": "Liquidar un pago sobre una decisión solo aceptada.",
  "landing.wont.l5": "Presentar datos históricos registrados como si fueran en vivo.",
  "landing.deployed":
    "Desplegado en {address} en {network} (cadena {id}). Los umbrales e importes de {scaled} se almacenan como enteros escalados, nunca como flotantes.",

  // --- hero evidence field (three.js) --------------------------------------
  "hero.threshold": "umbral {value} {unit}",
  "hero.drag": "arrastra para girar",
  "hero.split": "{day}: las fuentes discrepan · arrastra para girar",

  "how.h1": "Cómo se alcanza una decisión",
  "how.lede":
    "Un líder propone un resultado, varios validadores lo comprueban de forma independiente, y el resultado solo se conserva si suficientes coinciden en que significa lo mismo.",
  "how.leader.h": "Líder y validadores",
  "how.leader.p1":
    "Para una evaluación, un líder obtiene las fuentes elegibles y produce un resultado estructurado: una decisión, un motivo, cinco estados por comprobación y un valor observado. Esa propuesta no se acepta por confianza. Cada validador obtiene las mismas fuentes por su cuenta, las evalúa según las reglas de la póliza y produce su propio resultado.",
  "how.leader.p2":
    "El resultado se conserva cuando las conclusiones de los validadores son equivalentes, es decir, cuando significan lo mismo aunque su redacción difiera. Un validador cuyo propio resultado discrepa rechaza la propuesta en lugar de deferir a ella.",
  "how.equiv.h": "Qué cuenta como la misma respuesta",
  "how.equiv.p1":
    "El texto meteorológico no se compara byte a byte. Dos resultados se consideran equivalentes cuando:",
  "how.equiv.l1": "la decisión coincide exactamente;",
  "how.equiv.l2":
    "el motivo es el mismo, o está dentro de un grupo de equivalencia documentado;",
  "how.equiv.l3":
    "toda comprobación obligatoria —umbral superado, periodo cubierto, datos completos— coincide;",
  "how.equiv.l4":
    "el valor observado está dentro de una tolerancia documentada y queda del mismo lado del umbral que la decisión.",
  "how.equiv.p2":
    "Esa última condición es una guarda deliberada. Un validador no aceptará un «confirmado» cuyos propios números no alcanzan el umbral, así que los validadores no pueden coincidir en algo sencillamente equivocado. Las unidades y zonas horarias se normalizan antes de cualquier comparación, y la aritmética del umbral es código entero simple: nunca trabajo del modelo de lenguaje.",
  "how.inconclusive.h": "Por qué existe «inconcluyente»",
  "how.inconclusive.p1":
    "Cuando las pruebas no resuelven la cuestión, la respuesta honesta es que no la resuelven. ClimateClaim devuelve «inconcluyente» en cuatro situaciones distintas:",
  "how.inconclusive.l1t": "Conflicto de fuentes",
  "how.inconclusive.l1d":
    "dos fuentes discrepan sobre el cruce y la póliza no define ningún desempate.",
  "how.inconclusive.l2t": "Observaciones ausentes",
  "how.inconclusive.l2d":
    "el periodo no está completamente cubierto. El hueco se informa, nunca se rellena.",
  "how.inconclusive.l3t": "Discrepancia de ubicación",
  "how.inconclusive.l3d":
    "la estación comunicada está más lejos del punto de la póliza que la tolerancia de la propia póliza permite.",
  "how.inconclusive.l4t": "Fuentes inaccesibles",
  "how.inconclusive.l4d": "no se pudo recuperar nada, así que no había nada que evaluar.",
  "how.inconclusive.p2":
    "Esto es un resultado, no un error. También es el argumento más claro a favor de GenLayer: una única cadena determinista leyendo una API tendría que aprobar o rechazar la reclamación, y no tendría forma honesta de expresar el hueco.",
  "how.finality.h": "Aceptado no es final",
  "how.finality.p1":
    "Cuando los validadores coinciden, el resultado queda aceptado. Todavía puede impugnarse. Solo cuando la red lo finaliza pasa a ser final, y solo entonces puede producirse un pago. Esta aplicación muestra ambos estados por separado en todos los niveles, y el botón de liquidación permanece deshabilitado hasta que el propio contrato informa de que la decisión es final.",
  "how.finality.p2":
    "Una reclamación liquidada solo puede liquidarse una vez. El contrato registra un estado de liquidación y lo comprueba antes de cualquier transferencia, así que una llamada repetida no puede pagar dos veces.",
  "how.datamode.h": "Simulación histórica frente a datos en vivo",
  "how.datamode.p1":
    "Una reclamación de simulación histórica se juzga contra observaciones registradas. Los valores son fijos; volver a ejecutar la reclamación no los cambia. Una reclamación en vivo se juzga contra datos obtenidos en el momento de la evaluación, y una nueva evaluación puede producir una respuesta nueva. Toda superficie de póliza y reclamación de esta aplicación lleva una insignia que indica de cuál se trata.",
  "how.datamode.p2":
    "La evidencia que se muestra en esta aplicación se lee del contrato desplegado en {address} en {network} (cadena {id}). Cuando no es posible leer la cadena, la página lo dice y muestra una instantánea registrada en lugar de presentar datos obsoletos como si fueran en vivo.",
  "how.limits.h": "Limitaciones",
  "how.limits.l1":
    "Las fuentes meteorológicas difieren en un factor de dos el mismo día. Esa es la dispersión real de los modelos, no un error, y es exactamente la razón por la que existen las reglas de acuerdo.",
  "how.limits.l2":
    "Las fuentes de reanálisis informan de la celda de la cuadrícula que usaron, que puede situarse a varios kilómetros del punto solicitado. Una tolerancia de distancia estricta producirá resultados inconcluyentes.",
  "how.limits.l3":
    "El endpoint público de StudioNet está limitado a 30 peticiones por minuto, así que las lecturas se espacian y se deduplican.",
  "how.limits.l4ok":
    "Las reclamaciones en las redes de prueba públicas no se liquidan por valor real.",
  "how.limits.l4down":
    "El explorador de StudioNet está en pausa, así que los enlaces de transacción se muestran como no disponibles en lugar de como enlaces muertos.",

  "claims.h1": "Reclamaciones",
  "claims.lede":
    "Todas las reclamaciones siguientes existen en el contrato desplegado en {address} en {network}.",
  "claims.empty": "Aún no hay reclamaciones. Inicia una desde una póliza en la página de pólizas.",
  "claims.emptyLink": "página de pólizas",
  "claims.caption.one": "{count} reclamación leída de la cadena{suffix}.",
  "claims.caption.many": "{count} reclamaciones leídas de la cadena{suffix}.",
  "claims.captionSnapshot": " (instantánea registrada)",
  "claims.col.claim": "Reclamación",
  "claims.col.policy": "Póliza",
  "claims.col.state": "Estado",
  "claims.col.decision": "Decisión",
  "claims.col.round": "Ronda",
  "claims.col.final": "Final",
  "claims.evalFailed": "La evaluación no se completó",
  "claims.footer":
    "El modo demo reproduce ocho escenarios documentados, incluidos algunos sin reclamación en cadena.",

  "policies.h1": "Pólizas",
  "policies.lede":
    "Una póliza fija la ubicación, el periodo, el umbral, la regla de agregación y las fuentes elegibles. Una vez que una reclamación la referencia, no puede cambiarse.",
  "policies.empty": "Aún no hay pólizas. Abre la demo para ver qué produce una póliza.",
  "policies.caption": "{count} pólizas en el contrato desplegado.",
  "policies.col.policy": "Póliza",
  "policies.col.location": "Ubicación",
  "policies.col.condition": "Condición",
  "policies.col.dataMode": "Modo de datos",
  "policies.col.status": "Estado",
  "policies.new": "Crear una póliza",
  "policies.openList": "Abrir la lista de pólizas",
  "policies.notFound.h": "Póliza no encontrada",
  "policies.notFound.title": "Ninguna póliza llamada «{id}»",
  "policies.notFound.body":
    "Puede que se haya eliminado, o que la dirección sea de otro despliegue.",
  "policies.detail.h": "Póliza {id}",
  "policies.detail.locked":
    "Esta póliza está referenciada por una reclamación, así que ya no puede cambiarse.",
  "policies.detail.lockedBody":
    "La inmutabilidad tras el primer uso es lo que hace que una decisión sea auditable más adelante: los términos contra los que juzgó un validador no pueden desviarse.",
  "policies.terms.h": "Términos",
  "policies.terms.condition": "Condición",
  "policies.terms.location": "Ubicación",
  "policies.terms.tolerance": "Tolerancia de distancia",
  "policies.terms.period": "Periodo de observación",
  "policies.terms.metric": "Métrica",
  "policies.terms.aggregation": "Agregación",
  "policies.terms.sources": "Fuentes elegibles",
  "policies.terms.agreement": "Regla de acuerdo",
  "policies.terms.minSources": "Mínimo de fuentes",
  "policies.terms.payout": "Pago",
  "policies.terms.beneficiary": "Beneficiario",
  "policies.sources.h": "Fuentes elegibles",
  "policies.claims.h": "Reclamaciones de esta póliza",
  "policies.startHere": "Iniciar una reclamación",

  "policyNew.h1": "Crear una póliza",
  "policyNew.lede":
    "Una póliza fija por adelantado la ubicación, el periodo, el umbral, la regla de agregación y las fuentes elegibles. Una vez que una reclamación la referencia, nunca podrá cambiarse: eso es lo que hace auditable una decisión posterior.",
  "policyNew.ownerOnly": "Esta escritura es solo del propietario",
  "policyNew.ownerOnlyBody": "Solo el propietario del contrato puede crear una póliza.",
  "policyNew.wrongNetwork": "Red incorrecta",
  "policyNew.terms.h": "Términos",
  "policyNew.f.location": "Nombre de la ubicación",
  "policyNew.f.lat": "Latitud (grados)",
  "policyNew.f.lon": "Longitud (grados)",
  "policyNew.f.tolerance": "Tolerancia de distancia (metros)",
  "policyNew.f.toleranceHelp":
    "Cuánto puede alejarse la estación o celda de una observación de las coordenadas y seguir contando.",
  "policyNew.f.timezone": "Zona horaria",
  "policyNew.f.timezoneHelp":
    "Las ventanas de observación son días naturales UTC, y el contrato rechaza cualquier otro valor.",
  "policyNew.f.metric": "Métrica",
  "policyNew.f.metricHelp":
    "La unidad sigue a la métrica: el contrato solo acepta la unidad canónica.",
  "policyNew.f.periodStart": "Inicio del periodo de observación",
  "policyNew.f.periodEnd": "Fin del periodo de observación",
  "policyNew.f.comparator": "Comparación de umbral",
  "policyNew.f.threshold": "Umbral",
  "policyNew.f.thresholdHelp": "Se almacena como entero ×100, nunca como flotante.",
  "policyNew.f.aggregation": "Regla de agregación",
  "policyNew.f.agreement": "Regla de acuerdo entre fuentes",
  "policyNew.f.minSources": "Mínimo de fuentes coincidentes",
  "policyNew.f.payout": "Pago (unidades base)",
  "policyNew.f.dataMode": "Modo de datos",
  "policyNew.f.dataModeHelp":
    "El contrato no siembra fuentes propias: el registro solo contiene lo que registre el propietario.",
  "policyNew.mode.historical": "Simulación histórica",
  "policyNew.mode.historicalHelp":
    "Observaciones históricas registradas, no un feed en vivo. El periodo debe estar enteramente en el pasado; volver a ejecutar la reclamación no puede cambiar los datos subyacentes.",
  "policyNew.mode.live": "En vivo",
  "policyNew.mode.liveHelp":
    "Los valores se obtienen de la fuente en el momento de la evaluación. El resultado refleja el mundo ahora y puede variar entre evaluaciones.",
  "policyNew.f.condition": "Condición, en palabras claras",
  "policyNew.f.conditionHelp":
    "Se rellena a partir del resumen de abajo hasta que lo edites. Se guarda en cadena como forma legible de la póliza.",
  "policyNew.confirm.h": "Confirma la frase",
  "policyNew.confirm.help":
    "Esto es lo que leerán los validadores. Comprueba que dice lo que quieres: una errata aquí es un término de la póliza.",
  "policyNew.submit": "Crear póliza",
  "policyNew.cancel": "Cancelar",
  "policyNew.clearDraft": "Vaciar el formulario",
  "policyNew.draftRestored":
    "Borrador restaurado de tu última visita en este dispositivo.",
  "policyNew.submitting": "Creando",
  "policyNew.validation": "Corrige primero los campos marcados.",

  "claimDetail.notFound.h": "Reclamación no encontrada",
  "claimDetail.notFound.title": "Ninguna reclamación llamada «{id}»",
  "claimDetail.notFound.body":
    "Puede que se haya eliminado, o que la dirección sea de otro despliegue.",
  "claimDetail.h1": "Reclamación {id}",
  "claimDetail.evidence": "Evidencia",
  "claimDetail.checks": "Comprobaciones",
  "claimDetail.actions": "Acciones",
  "claimDetail.noWallet": "No se detectó cartera",
  "claimDetail.noWalletBody":
    "Leer reclamaciones está abierto a todos. Enviar una transacción necesita una cartera del navegador.",
  "claimDetail.wrongNetwork": "Red incorrecta",
  "claimDetail.startEvaluation": "Ejecutar evaluación",
  "claimDetail.finalize": "Finalizar decisión",
  "claimDetail.finalizeHelp":
    "Vuelve a leer la decisión en la finalidad; se niega si ha cambiado. Solo el propietario.",
  "claimDetail.reevaluate": "Volver a evaluar",
  "claimDetail.reevaluateHelp":
    "Ejecuta una nueva ronda de evaluación. Los motivos abiertos se conservan en el historial.",
  "claimDetail.dispute.open": "Impugnación abierta",
  "claimDetail.dispute.title": "Impugnar",
  "claimDetail.dispute.grounds": "Motivos de la impugnación",
  "claimDetail.dispute.placeholder":
    "¿Por qué debería impugnarse esta decisión? Nombra la fuente, la estación o el periodo de observación que crees que los validadores juzgaron mal.",
  "claimDetail.dispute.help":
    "El contrato guarda este texto junto con la impugnación y exige que no esté vacío, con al menos 10 caracteres.",
  "claimDetail.dispute.submit": "Abrir impugnación",
  "claimDetail.dispute.helpIntro":
    "Estos motivos se guardan en cadena y pasan al historial de impugnaciones cuando se abre la impugnación.",
  "claimDetail.settle.h": "Liquidación",
  "claimDetail.settle.none":
    "Esta póliza no tiene importe de pago, así que no hay nada que liquidar.",
  "claimDetail.settle.gate":
    "Emitir el pago solo es posible cuando la decisión es final. Una decisión aceptada todavía puede impugnarse.",
  "claimDetail.settle.ownerOnly": "Solo el propietario.",
  "claimDetail.settle.emit": "Emitir pago",
  "claimDetail.settle.emitted": "Pago emitido: entrega aún no verificada",
  "claimDetail.settle.emittedFull":
    "El mensaje de pago ha salido, así que la reclamación aún no está liquidada. En GenLayer el valor abandona este contrato de inmediato, pero solo llega al beneficiario cuando se activa la transacción secundaria del mensaje, y esa transacción aún puede fallar. Confírmala en el contrato para registrar el resultado. Nunca deduzcas la entrega del saldo del beneficiario.",
  "claimDetail.settle.markFailed": "Marcar el pago como fallido (reintentable)",
  "claimDetail.settle.failed":
    "El último intento de pago falló, así que no se pagó nada. La reclamación admite reintento: vuelve a emitir el pago una vez corregida la causa.",
  "claimDetail.timeline.h": "Progreso",
  "claimDetail.copySummary": "Copiar resumen",
  "claimDetail.disputes.h": "Impugnaciones",

  "demo.h1": "Modo demo",
  "demo.lede":
    "Ocho escenarios que cubren los resultados a los que puede llegar una reclamación real. Cada uno dice qué prueba, muestra las lecturas sobre las que se decidió, y está etiquetado con el origen de los datos.",
  "demo.whatItTests": "Qué prueba esto:",
  "demo.rejected": "Este intento se rechaza",
  "demo.rejectedBody":
    "Sin decisión, porque no se creó ninguna reclamación. El intento anterior fue rechazado.",
  "demo.decision": "Decisión",
  "demo.checks": "Comprobaciones registradas en cadena",
  "demo.scenarios": "Escenarios",
  "demo.howToRead": "Cómo interpretarlo",
  "demo.howToReadBody":
    "Cada escenario muestra la decisión, los estados por comprobación, el registro de auditoría y el ciclo de vida de la transacción.",
  "demo.whereNumbers": "De dónde salen los números",
  "demo.whereNumbersBody":
    "Las lecturas son una respuesta real registrada, y el resultado mostrado es lo que producen las reglas de evaluación del contrato para esos datos. No es una transacción y nunca se etiqueta como tal.",
  "demo.whereNumbersBody2":
    "Las lecturas proceden de los endpoints documentados, o de una respuesta registrada capturada de endpoints en vivo. En esta demo no se inventó ningún valor meteorológico.",
  "demo.startClaim": "Iniciar una reclamación",
  "demo.evaluate": "Evaluar",
  "demo.badgeLive": "{id} leída de la cadena",
  "demo.badgeReplay": "resultado que producen las reglas del contrato",
  "demo.provenance.onChain": "en cadena",
  "demo.provenance.replay": "repetición",
  "demo.provenance.onChainBody":
    "significa que la decisión mostrada se lee del contrato desplegado en {address}. Ábrela para ver la evidencia real, las comprobaciones, el registro de auditoría y el ciclo de vida de la transacción.",
  "demo.provenance.replayBody":
    "significa que las lecturas diarias son una respuesta real registrada de la fuente, y que el resultado mostrado es el que producen las reglas de evaluación del contrato para esos datos. No es una transacción y nunca se etiqueta como tal.",
  "demo.pinnedBy": "El resultado de cada escenario está fijado por una prueba directa:",
  "demo.fixtures":
    "Todas las lecturas registradas están en fixtures/historical/ y se han vuelto a verificar contra los endpoints en vivo. En esta demo no se inventó ningún valor meteorológico.",
  "demo.network": "Red: {network} (cadena {id}).",
  "demo.explorerLive": "Los enlaces al explorador están activos.",
  "demo.explorerDown": "El explorador está en pausa, así que los enlaces están desactivados.",

  // --- claims filtering and pagination -------------------------------------
  "claims.filter.h": "Filtrar y buscar",
  "claims.filter.search": "Id de reclamación o póliza",
  "claims.filter.decision": "Decisión",
  "claims.filter.state": "Estado",
  "claims.filter.all": "Todas",
  "claims.filter.pending": "Sin decidir",
  "claims.filter.clear": "Borrar filtros",
  "claims.filter.none": "Ninguna reclamación coincide con estos filtros.",
  "claims.filter.showing": "Mostrando {shown} de {total} reclamaciones.",
  "claims.pagination.prev": "Anterior",
  "claims.pagination.next": "Siguiente",
  "claims.pagination.page": "Página {page} de {pages}",

  // --- policy form: honest loading/empty/incomplete states -----------------
  "policyNew.sources.loading": "Cargando el registro de fuentes…",
  "policyNew.sources.emptyH": "Ninguna fuente mide {metric}",
  "policyNew.sources.empty": "El contrato no puede crear una póliza sin una fuente registrada, y no consta ninguna que mida {metric}: el registro no se pudo leer o está realmente vacío. Reintenta la lectura o pide al propietario que registre una con register_source.",
  "policyNew.sources.recorded": "Mostrando la instantánea registrada del registro; la lectura en vivo falló ({error}).",
  "policyNew.confirm.incomplete": "Aún falta: {fields}",
  "policyNew.missing.location": "el nombre del lugar",
  "policyNew.missing.dates": "las fechas de observación",
  "policyNew.missing.threshold": "el umbral",
  "policyNew.missing.sources": "al menos una fuente",

  // --- evidence comparison --------------------------------------------------
  "compare.h": "Comparación de fuentes por día",
  "compare.caption": "La lectura de cada fuente para cada día del periodo, en {unit}. La diferencia es la lectura más alta del día menos la más baja.",
  "compare.col.spread": "Diferencia",
  "compare.col.verdict": "Ese día",
  "compare.verdict.split": "las fuentes discrepan sobre el cruce",
  "compare.verdict.both": "ambas cruzan",
  "compare.verdict.neither": "ninguna cruza",
  "compare.verdict.single": "solo una fuente",
  "compare.noReadings": "sin lecturas",
  "compare.missing": "sin lectura",
  "compare.incomplete": "día incompleto",
  "compare.summaryOne": "Las fuentes discrepan sobre el umbral el {days}.",
  "compare.summaryNone": "Todos los días, las fuentes con lecturas coinciden sobre el umbral.",

  // --- the deterministic-chain contrast ------------------------------------
  "contrast.h": "Lo que habría dicho una cadena determinista",
  "contrast.badge": "experimento mental",
  "contrast.intro": "Un contrato que lee una sola fuente fija no puede expresar duda: debe devolver aprobado o denegado. Estas son las respuestas que cada fuente forzaría por sí sola, calculadas con las mismas lecturas registradas.",
  "contrast.sourceCard": "Si el contrato leyera solo {label}",
  "contrast.verdictConfirmed": "Condición confirmada — pago",
  "contrast.verdictNotConfirmed": "Condición no confirmada — sin pago",
  "contrast.observed": "Observado: {value} {unit}",
  "contrast.genlayerCard": "Lo que devolvió realmente el contrato desplegado",
  "contrast.genlayerVerdict": "No concluyente — conflicto de fuentes",
  "contrast.genlayerBody": "Las mismas lecturas, juzgadas con honestidad: las fuentes discrepan sobre el cruce y la póliza no define ningún desempate, así que la evidencia no resuelve la pregunta. No se fuerza ningún pago en ningún sentido.",
  "contrast.footnote": "No es un resultado de cadena. Las respuestas de la izquierda son una hipótesis, calculada localmente con las mismas lecturas registradas según la regla de comparación de la propia póliza; la respuesta de la derecha es lo que producen las reglas de evaluación del contrato, fijado por una prueba directa.",

  // --- chart accessibility --------------------------------------------------
  "evidence.chartAriaOne": "Gráfico de evidencia con una fuente durante {days} días.",
  "evidence.chartAriaMany": "Gráfico de evidencia con {sources} fuentes durante {days} días.",
  "evidence.pointPass": "{source} — {date}: {value} {unit}, cruza el umbral",
  "evidence.pointFail": "{source} — {date}: {value} {unit}, no cruza el umbral",

  // --- error boundary -------------------------------------------------------
  "errorBoundary.h": "Esta pantalla dejó de funcionar",
  "errorBoundary.body": "Un problema inesperado interrumpió esta página. El resto de la aplicación sigue funcionando: inténtalo de nuevo o vuelve al inicio.",
  "errorBoundary.home": "Ir a la página de inicio",

  // --- print receipt --------------------------------------------------------
  "audit.print": "Imprimir recibo",
  "audit.printHint": "Imprime esta página o guárdala como PDF. El diseño de impresión conserva solo el registro de la reclamación.",
  "audit.printNote": "Impreso {date} · contrato {address} · {network}",
};