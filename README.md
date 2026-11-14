# ParkFlung

Cinque domande a partita: più la tua risposta è rara, più strada fai lungo il sentiero,
dal carro di legno fino alla casa di Ale a Varigotti. App per telefono (PWA), in italiano.

- **Fasce di rarità:** morto di CACCA ADDOSSO ! (0), bada che storia (10), parata col petto (25),
  Shave like a Bomber! (50), Jonny 🍆 (75), Marco B. (100).
- **Domande:** circa 1000, di ogni genere, in ordine casuale diverso per ogni telefono. Escono prima
  quelle mai giocate e mai due della stessa famiglia nella stessa partita (per esempio due «Una città
  del…»); in Impostazioni si può scegliere se, finite quelle, devono ricapitare.
- **Fasce di rarità:** le risposte di ogni domanda, dalla più comune alla più rara, sono divise così:
  circa 20% comuni (solo le più ovvie, al massimo 10), 30% non comuni, 27% rare, 15% esclusive, 8% Marco B.
  Le risposte aggiunte da un secondo file per la stessa domanda finiscono una fascia più in alto.
- **Timer (facoltativo):** in Impostazioni si accende un timer per ogni domanda, da 30 s, 1, 2 o 5 minuti.
  Sta nell'angolo in alto a destra, passa da verde a giallo, arancione e rosso; se finisce, quella
  domanda vale «morto di CACCA ADDOSSO !».
- **Fine partita:** un'animazione a schermo intero che cresce con le tappe raggiunte: pioggia al carro,
  poi coriandoli, palloncini, fuochi d'artificio e, a 500 punti, la festa alla casa di Ale a Varigotti.
  In sviluppo `?finale=430` la mostra subito con quel punteggio.
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
