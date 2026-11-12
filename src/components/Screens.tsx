import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { builtIn, countFresh, mergeCustom } from '../game/bank'
import { parseUpload, type Question } from '../game/parse'
import { summarize, update, useSavedState } from '../game/store'
import { MAX_SCORE, OUTCOMES, STOPS, stopsReached, TIER_INFO, TIERS } from '../game/tiers'
import type { Result } from './Game'
import { TrailScene } from './TrailScene'

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
    </svg>
  )
}

export function Home({ bank, onPlay, onSettings }: { bank: Question[]; onPlay: () => void; onSettings: () => void }) {
  const saved = useSavedState()
  const stats = summarize(saved.games)
  const fresh = countFresh(bank, saved.seen)

  return (
    <main className="screen home">
      <div className="hero">
        <TrailScene points={0} label="Un sentiero che parte da un carro di legno e arriva a una casa gialla sul mare" />
        <button type="button" className="icon-button hero-settings" onClick={onSettings} aria-label="Impostazioni">
          <GearIcon />
        </button>
      </div>
      <div className="home-body">
        <h1 className="title">ParkFlung</h1>
        <p className="lede">Cinque domande. Più la tua risposta è rara, più strada fai verso la casa gialla sul mare.</p>
        <dl className="stats">
          <div>
            <dt>Partite</dt>
            <dd>{stats.played}</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>{stats.best}</dd>
          </div>
          <div>
            <dt>Media</dt>
            <dd>{stats.average}</dd>
          </div>
        </dl>
        <button type="button" className="btn" onClick={onPlay}>
          Gioca
        </button>
        <p className="note">
          {fresh > 0
            ? `${fresh} domande ancora mai giocate su ${bank.length}.`
            : `Hai giocato tutte le ${bank.length} domande: ora ricapitano, a partire da quelle viste da più tempo.`}
        </p>
      </div>
    </main>
  )
}

function destination(score: number): string {
  const reached = stopsReached(score)
  if (score >= MAX_SCORE) return 'Sei arrivato alla casa gialla sul mare!'
  if (reached === 0) return 'Sei rimasto vicino al carro.'
  if (reached === STOPS.length) return 'Ultima tappa superata: la casa gialla era a un passo.'
  return `Hai superato la tappa ${reached} di ${STOPS.length}.`
}

export function Summary({ results, onAgain, onHome }: { results: Result[]; onAgain: () => void; onHome: () => void }) {
  const score = results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
  // Start at the cart, then walk: the scene animates whenever its points change.
  const [walked, setWalked] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setWalked(score), 350)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <main className="screen summary">
      <div className="hero">
        <TrailScene points={walked} label={`Il sentiero: ${score} punti su ${MAX_SCORE}`} />
      </div>
      <div className="home-body">
        <p className="total">
          <strong>{score}</strong> / {MAX_SCORE}
        </p>
        <h1 className="destination">{destination(score)}</h1>
        <ol className="results">
          {results.map((result, index) => (
            <li key={result.question.id} className={`result tier-${result.outcome}`}>
              <details>
                <summary>
                  <span className="result-number">{index + 1}</span>
                  <span className="result-main">
                    <span className="result-prompt">{result.question.prompt}</span>
                    <span className="result-answer">
                      {result.answer ? result.answer.label : result.typed ? `«${result.typed}»` : 'Passata'}
                    </span>
                  </span>
                  <span className="result-tier">
                    <span className="chip">{TIER_INFO[result.outcome].label}</span>
                    <span className="result-points">+{TIER_INFO[result.outcome].points}</span>
                  </span>
                </summary>
                <div className="all-answers">
                  {TIERS.map((tier) => (
                    <p key={tier} className={`tier-${tier}`}>
                      <span className="chip">{TIER_INFO[tier].label}</span>{' '}
                      {result.question.answers
                        .filter((answer) => answer.tier === tier)
                        .map((answer) => answer.label)
                        .join(', ')}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ol>
        <p className="note">Tocca una domanda per vedere tutte le risposte possibili.</p>
        <button type="button" className="btn" onClick={onAgain}>
          Gioca ancora
        </button>
        <button type="button" className="btn ghost" onClick={onHome}>
          Torna all'inizio
        </button>
      </div>
    </main>
  )
}

const EXAMPLE = {
  domande: [
    {
      domanda: 'Un frutto rosso',
      risposte: {
        comune: ['fragola', 'ciliegia'],
        nonComune: ['lampone', 'anguria/cocomero'],
        rara: ['ribes', 'melograno/melagrana'],
        esclusiva: ['corbezzolo'],
        top: ['giuggiola', 'corniolo/corniola'],
      },
    },
  ],
}

export function Settings({ bank, onBack }: { bank: Question[]; onBack: () => void }) {
  const saved = useSavedState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; problems: string[] } | null>(null)
  const [confirming, setConfirming] = useState<'reset' | 'remove' | null>(null)
  const played = bank.length - countFresh(bank, saved.seen)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setMessage({ text: 'Non riesco a leggere il file.', problems: [] })
      return
    }
    const parsed = parseUpload(text)
    if (parsed.questions.length === 0) {
      setMessage({ text: 'Nessuna domanda aggiunta.', problems: parsed.problems })
      return
    }
    const merged = mergeCustom(saved.custom, parsed.questions)
    const stored = update((current) => ({ ...current, custom: merged.custom }))
    const parts = [`${merged.added} domande aggiunte`]
    if (merged.replaced > 0) parts.push(`${merged.replaced} aggiornate`)
    if (parsed.problems.length > 0) parts.push(`${parsed.problems.length} scartate`)
    setMessage({
      text: stored ? `${parts.join(', ')}.` : `${parts.join(', ')}, ma il telefono non ha spazio per salvarle.`,
      problems: parsed.problems,
    })
  }

  function downloadExample() {
    const blob = new Blob([JSON.stringify(EXAMPLE, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'parkflung-domande-esempio.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <main className="screen settings">
      <header className="game-top">
        <button type="button" className="link" onClick={onBack}>
          Indietro
        </button>
        <p className="game-count">Impostazioni</p>
        <span />
      </header>

      <section className="panel">
        <h2>Domande</h2>
        <p>
          {bank.length} domande in tutto: {builtIn.questions.length} incluse nell'app e {saved.custom.length} caricate
          da te. Ne hai già giocate {played}.
        </p>
        <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={onFile} />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Carica domande da file
        </button>
        <button type="button" className="btn ghost" onClick={downloadExample}>
          Scarica un file di esempio
        </button>
        {message && (
          <div className="message" role="status">
            <p>{message.text}</p>
            {message.problems.length > 0 && (
              <ul>
                {message.problems.slice(0, 6).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
                {message.problems.length > 6 && <li>…e altre {message.problems.length - 6}.</li>}
              </ul>
            )}
          </div>
        )}
        <p className="note">
          Il file può essere JSON (come l'esempio) oppure testo, una domanda per riga:
          <br />
          <code>domanda :: comuni :: non comuni :: rare :: esclusive :: top</code>
          <br />
          Le risposte si separano con la virgola, i modi diversi di scrivere la stessa risposta con «/».
        </p>
        {saved.custom.length > 0 &&
          (confirming === 'remove' ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                update((current) => ({ ...current, custom: [] }))
                setConfirming(null)
                setMessage({ text: 'Domande caricate rimosse.', problems: [] })
              }}
            >
              Conferma: rimuovi le {saved.custom.length} caricate
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirming('remove')}>
              Rimuovi le domande caricate
            </button>
          ))}
      </section>

      <section className="panel">
        <h2>Punti</h2>
        <ul className="legend">
          {OUTCOMES.map((outcome) => (
            <li key={outcome} className={`tier-${outcome}`}>
              <span className="chip">{TIER_INFO[outcome].label}</span>
              <span className="legend-rarity">{TIER_INFO[outcome].rarity}</span>
              <span className="legend-points">{TIER_INFO[outcome].points}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          Cinque domande a partita, massimo {MAX_SCORE} punti. Lungo il sentiero c'è una tappa ogni {STOPS[0]} punti.
        </p>
      </section>

      <section className="panel">
        <h2>Progressi</h2>
        <p>Azzera partite, record e l'elenco delle domande già giocate. Le domande caricate restano.</p>
        {confirming === 'reset' ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              update((current) => ({ ...current, seen: {}, games: [] }))
              setConfirming(null)
            }}
          >
            Conferma: azzera tutto
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirming('reset')}>
            Azzera i progressi
          </button>
        )}
      </section>

      <p className="note version">ParkFlung {__APP_VERSION__}</p>
    </main>
  )
}
