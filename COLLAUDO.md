# Collaudo · Registro Ore Lavoro

Dati di prova sintetici. Il progetto consegnato apre un archivio vuoto.

| Verifica | Esito |
|---|---|
| Profilo, luogo abituale, logo, tema e giornata tipo | Creazione e modifica effettuate in Chromium. Profilo e impostazioni conservati alla riapertura. |
| Registro giornaliero | Creazione, modifica, copia da altra data ed eliminazione con conferma. Provato il rifiuto di 70 minuti e il salvataggio dopo la correzione. |
| Giornata tipo su uno o più giorni | Verificata la compilazione singola e multipla. La scelta «Solo giorni vuoti» ha mantenuto un permesso già compilato. |
| Calendario e durate | Febbraio 2024 con 29 giorni nel browser. Sei test automatici passati, inclusi febbraio negli anni 1900 e 2000, cambi mese, campi vuoti, decimali, stati e backup. |
| Assenze | Permesso con nota salvato e copiato nel browser. Ferie, malattia, permesso, riposo, altro e ore inserite a mano verificati nei test dei totali. |
| Backup e ripristino | Scaricato e reimportato un JSON con due mesi, profilo, immagine e tema. Confermata la sostituzione, poi verificato il risultato dopo la riapertura. Una versione sconosciuta è stata rifiutata. |
| PDF | Anteprima e download effettuati. Aperto con PyMuPDF. Cinque pagine A4 correttamente generate per una nota estesa, con logo e testo finale leggibile. |
| Excel | Scaricato il file .xlsx e aperto con openpyxl. Verificati struttura Excel, formati delle durate, valori numerici, formule dei totali e nota che inizia con = mantenuta come testo. |
| Coerenza | Caso di prova con 8 h 30 min in sede, 1 h 15 min fuori sede, 15 min di viaggio e 12,375 km. App, PDF e Excel davano 10 h e 12,375 km. |
| Layout | Controllato in Chromium con riquadri larghi 393 e 402 px, senza scorrimento laterale anche con la barra di scorrimento desktop. Pulsanti del calendario da 44,5 × 51 px in su. Viste e controlli principali etichettati nell’albero di accessibilità. |

Per ripetere i test inclusi usa `node --test qa/core.test.mjs` con Node.js 22 o compatibile.

## Verifiche che richiedono un dispositivo

Safari su iPhone fisico, apertura come app dalla Home, menu iOS di condivisione, offline in modalità aereo e apertura direttamente in Numbers non sono stati verificati su hardware reale. PDF e XLSX sono stati letti con librerie indipendenti dopo averli generati e scaricati nel browser. La conformità del PDF ai requisiti interni dell’azienda va confermata da chi lo riceve.


## Modulo compatto

- In Chromium, record precedenti letti correttamente dopo l’aggiornamento, inclusa una nota estesa. Provati totale in tempo reale, campo minuti non valido, apertura della sezione con l'errore, trasferte, assenza con nota e salvataggio della giornata tipo in un tocco per una data vuota. Verificato che il comando rapido sia assente quando oggi è già registrato.
- Modulo controllato in riquadri da 393 e 402 px. Campi ore e pulsante Salva misurati rispettivamente a 51 e 49 px di altezza.
- Verificati il nuovo logo in app e le dimensioni delle icone del manifest.

## Stile dell’interfaccia

- Home, calendario e scheda delle ore controllati in Chromium con temi chiaro e scuro, nei layout desktop e mobile. Verificato il calendario a 402 px e la scheda giornaliera a 393 px, senza scorrimento orizzontale.
- Verificato il salvataggio di una modifica e ripetuta la generazione dell’anteprima PDF e di Excel con il nuovo layout.

## Logo AT SYSTEM SERVICE e Home

- Titolo completo, icona e pulsante principale verificati in Chromium a 393 e 402 px. Il pulsante per registrare oggi è alto 53 px.
- Verificati cambio mese, dettaglio mensile, salvataggio della giornata tipo, modifica delle ore e aggiornamento del totale in Home e PDF. Preparazione di Excel riuscita.

## Monogramma 3D

- Verificati il render locale (1.778 byte in WebP), l’icona, il titolo e l’apertura della scheda di oggi in Chromium a 393 e 402 px.
- La scena di modellazione usa una luce, una texture e sette materiali. La Home visualizza il render con una breve risposta del pulsante in CSS e rispetta la preferenza per il movimento ridotto.

## Sfondi della Home e profilo unico

- Sfondi controllati in Chromium a 393 px con tema scuro e a 402 px con tema chiaro. Verificati l’apertura della giornata e il dettaglio del mese.
- Profilo di Angelo Argese verificato in app, nell’anteprima PDF e nel file XLSX. Il test dei backup precedenti verifica che il ripristino conservi giornate e impostazioni e applichi l’intestazione fissa.

## Inserimento rapido

- In Chromium a 393 px, usato il tasto 8 h e aggiunto a mano 30 min in sede e 45 min fuori sede. Il totale di 9 h 15 min è comparso nella scheda e in Home dopo il salvataggio. I tasti rapidi misurano 44 px in altezza e Salva 49 px.
- A 402 px, salvate ferie con nota e zero ore. Verificati il menu di copia, l’eliminazione con conferma e il salvataggio in un tocco della giornata tipo di 8 h in Officina, anche consultando un altro mese. Entrambe le larghezze sono state verificate senza scorrimento orizzontale.
