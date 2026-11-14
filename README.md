# ParkFlung

Una domanda dopo l'altra: più la tua risposta è rara, più strada fai lungo il sentiero, dal carro
di legno fino alla casa di Ale a Varigotti. La partita finisce solo quando ci arrivi. App per telefono
(PWA), in italiano.

- **Partita fino alla casa:** a 500 o a 1000 punti, si sceglie nella Home. La partita si salva a ogni
  risposta: si può uscire e continuarla dopo, anche chiudendo l'app.
- **Domande contate:** al massimo 20 domande a 500 punti, 40 a 1000. Se finiscono prima della casa,
  parte un'animazione a schermo intero: l'omino cammina fino a dove si è fermato, nel meteo del suo
  mondo, con una festa che cresce col mondo raggiunto (pioggia nel temporale, fuochi al tramonto).
  Poi il riepilogo, dove sotto ogni domanda si aprono tutte le risposte possibili. In sviluppo
  `?finale=230` la mostra subito.
- **Casella imprevisti «?»:** esattamente a metà sentiero (250 o 500 punti). Quando l'omino ci arriva
  si sceglie a schermo intero: continuare senza imprevisto o girare la ruota della fortuna. La ruota ha
  cinque spicchi, tutti con la stessa probabilità: +100 punti al traguardo e −3 domande (malus, rossi),
  +3 domande e −100 punti al traguardo (bonus, blu) e la Carta Rivincita (oro): per tutta la partita,
  dopo un «morto di CACCA ADDOSSO !» si può rispondere di nuovo alla stessa domanda, una volta per
  domanda. In sviluppo `?imprevisto` mostra subito la scelta e la ruota.
- **Cinque mondi:** il meteo cambia ogni quinto di sentiero (100 o 200 punti): temporale con i fulmini,
  pioggerella, nuvole e sole, sole, tramonto. Si vede nella camminata a schermo intero e nel riepilogo
  punti dopo ogni risposta.
- **Camminata:** tutto il sentiero resta in vista (niente zoom) e il tratto già fatto si colora.
- **Mondo completato:** ogni volta che si passa al mondo dopo parte un'animazione a schermo intero,
  sempre più ricca: il temporale che se ne va, l'arcobaleno, il sole che sfonda le nuvole, il tramonto
  sul mare con i fuochi d'artificio. In sviluppo `?mondo=0` … `?mondo=3` le mostra subito.

- **Fasce di rarità:** morto di CACCA ADDOSSO ! (0), bada che storia (10), parata col petto (25),
  Shave like a Bomber! (50), Jonny 🍆 (75), Marco B. (100).
- **Rivelazione:** il termometro si ferma, il gradino vicino lampeggia e poi la barra sale o ricade,
  metà e metà, per ogni fascia (anche per «morto di CACCA ADDOSSO !»).
- **Domande:** circa 1000, di ogni genere, in ordine casuale diverso per ogni telefono. Escono prima
  quelle mai giocate, mai una ripetuta nella stessa partita e mai due della stessa famiglia vicine
  (per esempio due «Una città del…»); in Impostazioni si può scegliere se, finite quelle, devono ricapitare.
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
- **Solo tema chiaro**, anche quando il telefono è in modalità scura.
- **Nuove domande:** Impostazioni → «Carica domande da file» (JSON o testo, c'è un file di esempio).

## Formato delle domande

`src/data/*.txt`, una domanda per riga:

```
domanda :: comuni :: non comuni :: rare :: esclusive :: top
```

Risposte separate da virgole, dalla più comune alla più rara; modi diversi di scrivere la stessa
risposta separati da `/`. La divisione in fasce la rifà il gioco con queste percentuali, quindi conta
soprattutto l'ordine. Se una domanda compare in più file, le risposte si sommano (`pack-50-extra.txt`).
Una sola domanda «… che inizia con la X» per argomento è generata da quelle scritte (`src/game/bank.ts`).

## Comandi

```bash
npm install
npm run dev      # anteprima su http://localhost:5173/parkflung/
npm test         # controlla logica e domande
npm run build
```

Ogni push su `main` pubblica l'app su GitHub Pages (`.github/workflows/deploy.yml`).
