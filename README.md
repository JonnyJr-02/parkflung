# ParkFlung

Una domanda dopo l'altra: più la tua risposta è rara, più strada fai lungo il sentiero, dal carro
di legno fino alla casa di Ale a Varigotti. La partita finisce solo quando ci arrivi. App per telefono
(PWA), in italiano.

- **Partita fino alla casa:** a 500 o a 1000 punti, si sceglie nella Home. La partita si salva a ogni
  risposta: si può uscire e continuarla dopo, anche chiudendo l'app.
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
- **Fasce di rarità:** le risposte di ogni domanda, dalla più comune alla più rara, sono divise così:
  circa 20% comuni (solo le più ovvie, al massimo 10), 30% non comuni, 27% rare, 15% esclusive, 8% Marco B.
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
