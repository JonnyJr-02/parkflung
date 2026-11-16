# ParkFlung

Una domanda dopo l'altra: più la tua risposta è rara, più strada fa l'omino lungo il sentiero, fino
al traguardo del mondo. App per telefono (PWA), in italiano.

- **Cinque mondi**, uno dopo l'altro: nella Home si scorrono a destra e a sinistra. All'inizio è aperto
  solo il primo; arrivando al traguardo di un mondo si sblocca il successivo, e quelli già sbloccati
  restano sempre giocabili. «Azzera i progressi» li richiude. Ogni mondo ha la sua partita salvata,
  il suo paesaggio, il suo omino, il suo traguardo e la sua musica.
  1. **Parcheggio** (500 punti): di notte; step Sobri, Un po' fatti (luna), Decisamente fatti
     (stelle), Fattissimi (draghi), Jo sta male (paese delle meraviglie). L'omino fuma; il traguardo
     è la macchina col bagagliaio aperto. Un imprevisto a 250.
  2. **Tigros** (750): dal temporale al sole, poi la notte. L'omino va sul carrello con la bottiglia
     verde; il traguardo è il supermercato. Un imprevisto a 375.
  3. **Casa di Ale** (1000): dal temporale al sole di mezzogiorno. Costume e gonfiabile; il traguardo
     è la casa gialla con le persiane verdi, la piscina davanti e il cane bianco sul tappetino, tra colline
     e alberi di limoni. Imprevisti a 250 e a 750 (obbligatorio).
  4. **Varigotti** (1250): il gioco originale, dal temporale al tramonto, fino alla casa di Ale a
     Varigotti. Imprevisti a 250 e a 750 (obbligatorio).
  5. **Decanter** (1500): di notte; step Sobri, Sbrillo, Birillo, Ubriachi, 💀. Boccale in mano; il
     traguardo è il pub: facciata scura, insegna bordeaux con «decanter» in bianco, vetrine calde con le bottiglie e le tende rosse. Imprevisti obbligatori a 500 e a 1000.
- **Step:** ogni mondo ne ha 5, uno ogni quinto di sentiero, con il cielo che cambia. Entrando in uno
  step nuovo parte un'animazione a schermo intero con un suono. Negli step «fatti» la scena ondeggia.
- **Domande:** una ogni 25 punti (20, 30, 40, 50, 60 dal Parcheggio al Decanter), il 25% in meno senza
  hardcore. 5 «cambia domanda» a partita in ogni mondo. Se finiscono le domande prima del traguardo,
  un'animazione mostra dove si è fermato l'omino, poi il riepilogo con tutte le risposte.
- **Imprevisti «?»:** ruota della fortuna con spicchi della stessa probabilità. Classica (si può
  saltare): +100 punti al traguardo e −3 domande (malus), +3 domande e −100 punti (bonus), Carta
  Rivincita. Obbligatoria: 4 malus (+100, +200 al traguardo, −3, −5 domande); al Decanter con la
  Carta Rivincita o con la Carta Diamante (punti doppi per il resto della partita).
- **Modalità hardcore (spenta di default):** in Impostazioni. Senza hardcore non esiste «morto di
  CACCA ADDOSSO !»: una risposta che non è tra quelle valide fa riprovare, se si passa o finisce il tempo
  la domanda vale 0 punti e la Carta Rivincita fa riprovare dopo «bada che storia».
- **Suoni:** generati dal codice (Web Audio). Una musica diversa per ogni mondo, in tutto il gioco; nella
  Home cambia mentre si scorrono i mondi. Effetti solo per il termometro e per lo sblocco di step e
  mondi. In Impostazioni si spengono «Musica» ed «Effetti sonori».
- **In sviluppo:** `?sblocca` apre tutti i mondi, `?step=parcheggio-4` mostra l'animazione di uno step,
  `?ruota=malus-diamond` una ruota, `?finale=decanter` l'arrivo e `?finale=tigros-230` le domande finite.

- **Fasce di rarità:** morto di CACCA ADDOSSO ! (0), bada che storia (10), parata col petto (25),
  Shave like a Bomber! (50), Jonny 🍆 (75), Marco B. (100).
- **Rivelazione:** il termometro si ferma, il gradino vicino lampeggia e poi la barra sale o ricade,
  metà e metà, per ogni fascia (anche per «morto di CACCA ADDOSSO !»).
- **Domande:** 1516, di ogni genere, in ordine casuale diverso per ogni telefono. Escono prima
  quelle mai giocate, mai una ripetuta nella stessa partita e mai due della stessa famiglia vicine
  (per esempio due «Una città del…»); in Impostazioni si può scegliere se, finite quelle, devono ricapitare.
  Le domande troppo aperte («Una cosa rossa», «Una cosa che fa rumore»…) sono state tolte o rese più
  precise; 93 domande chiuse (film di un regista o con un attore, calciatori di una squadra, canzoni di
  un cantante, libri, quadri, premi Nobel…) vengono da Wikidata, con le risposte in ordine di fama.
  Geografia (`pack-72-geografia.txt`): confini (Francia, Austria, Cina, Russia, Brasile), mari e oceani
  (Baltico, Nero o Caspio, Indiano, Pacifico, Atlantico), bandiere (stelle, tre strisce verticali,
  croce, animale) e «Uno Stato che inizia con la …».
- **Risposte riconosciute:** contano anche senza le parole tra parentesi («Argo» per «Argo (cane di
  Ulisse)»), senza le parole piccole e in un altro ordine («frutto passione», «Pisa torre») e quando
  sono il nome dentro una risposta più lunga («Montalbano» per «Il commissario Montalbano»). Se il
  pezzo scritto va bene per più risposte, o ha parole in più, il gioco chiede «Forse intendevi…?».
- **Fasce di rarità:** le risposte di ogni domanda, dalla più comune alla più rara, sono divise in tre
  parti: circa metà per bada che storia e parata col petto, metà per Shave like a Bomber! e Jonny 🍆,
  poche per Marco B. Dentro ogni coppia le due fasce hanno lo stesso numero di risposte: le più facili
  vanno nella prima (bada che storia, Shave like a Bomber!), le meno ovvie nella seconda.
  Le risposte aggiunte da un secondo file per la stessa domanda finiscono una fascia più in alto.
- **Timer (facoltativo):** in Impostazioni si accende un timer per ogni domanda, da 30 s, 1, 2 o 5 minuti.
  Sta nell'angolo in alto a destra, passa da verde a giallo, arancione e rosso; se finisce, quella
  domanda vale «morto di CACCA ADDOSSO !».
- **Arrivo:** alla casa di Ale parte l'animazione più bella, a schermo intero (fuochi d'artificio, coriandoli,
  palloncini, la casa con le finestre accese), poi il riepilogo con tutte le risposte della partita.
  In sviluppo `?finale` la mostra subito.
- **Fine del gioco:** arrivando al Decanter, l'ultimo mondo, dopo l'arrivo compare a tutto schermo
  «Il gioco è finito!» con i fuochi d'artificio, poi scorrono lenti i titoli di coda con una canzoncina
  tutta loro (Creato da, Ideato da, Graphic design, Music design: Claude; Assolutamente nessun merito:
  Jo, Chri, Ale, Tina, Sara, Roma, Colo, Vale, Nico). Non si possono saltare: il pulsante per il
  riepilogo arriva solo alla fine, dopo «Fine». In sviluppo `?titoli` li mostra subito.
- **Solo tema chiaro**, anche quando il telefono è in modalità scura.
- **Nuove domande:** Impostazioni → «Carica domande da file» (JSON o testo, c'è un file di esempio).

## Formato delle domande

`src/data/*.txt`, una domanda per riga:

```
domanda :: comuni :: non comuni :: rare :: esclusive :: top
```

Risposte separate da virgole, dalla più comune alla più rara; modi diversi di scrivere la stessa
risposta separati da `/`. La divisione in fasce la rifà il gioco con queste percentuali, quindi conta
soprattutto l'ordine. Se una domanda compare in più file, le risposte si sommano (`pack-50-extra.txt`,
`pack-90-extra.txt`). Le domande da Wikidata sono in `pack-70-wikidata.txt`: in cima le risposte con la
voce di Wikipedia presente in più lingue e più lunga in italiano (per le città conta anche quanti abitanti hanno).
Una sola domanda «… che inizia con la X» per argomento è generata da quelle scritte (`src/game/bank.ts`).

## Comandi

```bash
npm install
npm run dev      # anteprima su http://localhost:5173/parkflung/
npm test         # controlla logica e domande
npm run build
```

Ogni push su `main` pubblica l'app su GitHub Pages (`.github/workflows/deploy.yml`).
