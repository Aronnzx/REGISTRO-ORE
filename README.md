# AT SYSTEM SERVICE · Registro ore

Web app per compilare il registro giornaliero di ore, trasferte, chilometri e assenze, consultare i totali mensili e preparare PDF A4 o Excel. Il PDF riprende le colonne della scheda cartacea, con lo stato nel campo Note e l’anno nel periodo. Il foglio aziendale va controllato prima dell’invio.

## Su iPhone 15 e iPhone 17 Pro

1. Apri in **Safari** l’indirizzo HTTPS del registro. Se l’indirizzo ha accesso privato, accedi con l’account autorizzato.
2. Tocca **Condividi → Aggiungi alla schermata Home**. Attiva **Apri come app web**, se compare, e tocca **Aggiungi**.
3. Apri l’icona **AT Service** dalla Home prima di inserire dati. Safari e l’app installata possono tenere archivi separati.
4. Il profilo è già intestato ad **Angelo Argese**. Per usare la giornata tipo, apri **Profilo** e imposta il luogo abituale, le ore in sede oppure entrambi. Le impostazioni si salvano mentre scrivi.
5. Da **Home**, tocca **Registra oggi** oppure **Compila a mano**. Tocca **4 h**, **6 h** o **8 h** per impostare le ore in sede, oppure scrivi ore e minuti. Scegli **Tipo di giornata** per registrare un’assenza e apri le sezioni per trasferte, luogo o note quando ti servono. Tocca **Salva**. Se hai impostato la giornata tipo e oggi è ancora vuoto, **Salva giornata tipo** dalla Home registra in un tocco i valori mostrati. Per un’altra data usa **Calendario**. Trovi la copia e l’eliminazione in **Altre azioni** nella scheda del giorno.
6. In Home, apri **Dettaglio del mese** per consultare ore in sede, trasferte, chilometri e assenze. In **Calendario** trovi le giornate già registrate.
7. A fine mese apri **Esporta → Apri anteprima PDF**. Controlla tutte le pagine e tocca **Salva PDF** o **Condividi PDF**. Per Excel usa **Prepara Excel → Salva Excel**. Quando il pulsante di condivisione è disponibile puoi usarlo direttamente. In alternativa, cerca il download nell’app **File** e condividilo da lì.

In Calendario, **Seleziona più giorni** permette di applicare la giornata tipo anche a date non consecutive. Se sono presenti giornate già compilate, puoi conservare quei dati e applicare il profilo solo ai giorni vuoti, oppure confermare la sostituzione dei campi nei giorni selezionati.

## Backup e trasferimento

1. Sul primo dispositivo apri **Profilo → Prepara backup → Salva backup**. Salva il file JSON in File oppure condividilo, per esempio con AirDrop.
2. Sul secondo dispositivo apri il registro nella modalità che userai ogni giorno. Vai su **Profilo → Importa backup** e scegli il JSON.
3. Controlla il numero di giornate e conferma **Sostituisci dati**. Il ripristino sostituisce tutti i mesi e le impostazioni, compresi logo e giornata tipo. Le giornate importate vengono intestate ad Angelo Argese. Salva un backup dell’archivio di destinazione prima di sostituirlo se contiene dati che ti servono.

I due dispositivi hanno archivi indipendenti. La cancellazione dei dati del sito può eliminare il registro. Chi riceve il JSON può leggere tutti i dati contenuti. Anche PDF ed Excel includono i dati che scegli di esportare.

## Avvio del progetto

La cartella `dist` contiene l’app pronta da servire. Include codice, librerie PDF e ZIP, grafica, icone e manifest. I file esportati sono generati sul dispositivo. Il formato Excel usa durate numeriche e formule per i totali. Le note e i luoghi sono celle di testo.

- **Sul computer con Python 3.** Clona il repository oppure scarica ed estrai lo ZIP, quindi apri un terminale nella cartella del progetto ed esegui `python -m http.server 8080 --directory dist`. Su Windows puoi usare `py -m http.server 8080 --directory dist`. Apri `http://localhost:8080`.
- **Su iPhone con un hosting tuo.** Pubblica il contenuto di `dist` su un hosting statico HTTPS e apri l’indirizzo in Safari. Conserva lo stesso indirizzo per ritrovare il registro. Quando cambi indirizzo, trasferisci il backup.
- **Su iPhone sulla rete di casa.** Con il server Python acceso e il telefono sullo stesso Wi-Fi, apri in Safari `http://INDIRIZZO-IP-DEL-COMPUTER:8080`. Questa opzione dipende dalla rete locale e dal computer acceso. Su HTTP fuori da localhost sono disponibili la compilazione e i download. La cache offline e la condivisione diretta richiedono un contesto sicuro.

Internet serve per raggiungere la versione ospitata la prima volta e per scaricare gli aggiornamenti. Su HTTPS, dopo che il browser ha completato la cache dell’app, è possibile lavorare anche offline finché la cache è disponibile. L’hosting può richiedere l’accesso prima di servire l’app. L’archivio compilato usa IndexedDB e non richiede un account dell’app. Cambiando versione, incrementa il nome della cache in `dist/sw.js` quando cambiano i file inclusi.

## Riferimenti

- [Apple · Utilizzare un sito web come un’app in Safari su iPhone](https://support.apple.com/it-it/guide/iphone/iphea86e5236/ios)
- [WebKit · Archivi delle app nella schermata Home](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps)
- [Parhi, Karlson e Bederson, 2006 · Studio sulle dimensioni dei controlli touch usati con una mano](https://www.microsoft.com/en-us/research/wp-content/uploads/2006/01/parhi-mobileHCI06.pdf)
