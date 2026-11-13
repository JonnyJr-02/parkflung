# ParkFlung

Cinque domande a partita: più la tua risposta è rara, più strada fai lungo il sentiero,
dal carro di legno fino alla casa di Ale a Varigotti. App per telefono (PWA), in italiano.

- **Fasce di rarità:** morto di CACCA ADDOSSO ! (0), bada che storia (10), parata col petto (25),
  Shave like a Bomber! (50), Jonny 🍆 (75), Marco B. (100).
- **Domande:** circa 700, di ogni genere, in ordine casuale diverso per ogni telefono. Escono prima
  quelle mai giocate e mai due della stessa famiglia nella stessa partita (per esempio due «Una città
  del…»); in Impostazioni si può scegliere se, finite quelle, devono ricapitare.
- **Rarità a mezza campana:** le risposte di ogni domanda, dalla più comune alla più rara, sono
  divise come la metà di una gaussiana: la fascia più grande è la comune e ogni fascia più rara è più
  piccola (circa 38% comuni, 30% non comuni, 18% rare, 9% esclusive, 5% Marco B.).
- **Nuove domande:** Impostazioni → «Carica domande da file» (JSON o testo, c'è un file di esempio).

## Formato delle domande

`src/data/*.txt`, una domanda per riga:

```
domanda :: comuni :: non comuni :: rare :: esclusive :: top
```

Risposte separate da virgole, dalla più comune alla più rara; modi diversi di scrivere la stessa
risposta separati da `/`. La divisione in fasce la rifà il gioco con la mezza campana, quindi conta
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
