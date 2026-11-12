# ParkFlung

Cinque domande a partita: più la tua risposta è rara, più strada fai lungo il sentiero,
dal carro di legno fino alla casa gialla sul mare. App per telefono (PWA), in italiano.

- **Fasce di rarità:** morto di CACCA ADDOSSO ! (0), bada che storia (10), parata col petto (25),
  Shave like a Bomber! (50), Jonny 🍆 (75), Marco B. (100).
- **Domande:** circa 730, in ordine casuale diverso per ogni telefono. Escono prima quelle mai giocate;
  in Impostazioni si può scegliere se, finite quelle, devono ricapitare.
- **Nuove domande:** Impostazioni → «Carica domande da file» (JSON o testo, c'è un file di esempio).

## Formato delle domande

`src/data/*.txt`, una domanda per riga:

```
domanda :: comuni :: non comuni :: rare :: esclusive :: top
```

Risposte separate da virgole; modi diversi di scrivere la stessa risposta separati da `/`.
Le domande «… che inizia con la X» sono generate da quelle scritte (`src/game/bank.ts`).

## Comandi

```bash
npm install
npm run dev      # anteprima su http://localhost:5173/parkflung/
npm test         # controlla logica e domande
npm run build
```

Ogni push su `main` pubblica l'app su GitHub Pages (`.github/workflows/deploy.yml`).
