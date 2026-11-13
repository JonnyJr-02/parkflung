import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { builtIn, countFresh, derived, mergeCustom } from '../game/bank'
import { parseUpload, type Question } from '../game/parse'
import { TIMER_CHOICES, timerLabel } from '../game/timer'
import { summarize, update, useSavedState } from '../game/store'
import { MAX_SCORE, OUTCOMES, QUESTIONS_PER_GAME, STOPS, stopsReached, TIER_INFO, TIERS } from '../game/tiers'
import type { Result } from './Game'
import { useThemePref, type ThemePref } from '../theme'
import { Scene } from './Scene'

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
    </svg>
  )
}

function homeNote(total: number, fresh: number, repeat: boolean): string {
  if (!repeat && fresh < QUESTIONS_PER_GAME) {
    return 'Hai finito le domande nuove. Attiva «Ripeti le domande» nelle impostazioni, oppure azzera i progressi.'
  }
  if (!repeat) return `${fresh} domande nuove rimaste su ${total}. Le domande già giocate non ricapitano.`
  if (fresh > 0) return `${fresh} domande ancora mai giocate su ${total}.`
  return `Hai giocato tutte le ${total} domande: ora ricapitano, a partire da quelle viste da più tempo.`
}

export function Home({ bank, onPlay, onSettings }: { bank: Question[]; onPlay: () => void; onSettings: () => void }) {
  const saved = useSavedState()
  const stats = summarize(saved.games)
  const fresh = countFresh(bank, saved.seen)
  const canPlay = saved.repeat || fresh >= QUESTIONS_PER_GAME

  return (
    <main className="screen home">
      <Scene
        className="hero"
        points={0}
        label="Un manifesto della riviera: un sentiero parte da un carro di legno e arriva alla casa di Ale a Varigotti, sul mare"
      >
        <button type="button" className="icon-button hero-settings" onClick={onSettings} aria-label="Impostazioni">
          <GearIcon />
        </button>
      </Scene>
      <div className="home-body">
        <h1 className="title">
          Park<em>Flung</em>
        </h1>
        <p className="lede">Cinque domande. Più la tua risposta è rara, più strada fai verso la casa di Ale&nbsp;a&nbsp;Varigotti.</p>
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
        {canPlay ? (
          <button type="button" className="btn" onClick={onPlay}>
            Gioca
          </button>
        ) : (
          <button type="button" className="btn" onClick={onSettings}>
            Apri le impostazioni
          </button>
        )}
        <p className="note">{homeNote(bank.length, fresh, saved.repeat)}</p>
      </div>
    </main>
  )
}

function destination(score: number): string {
  const reached = stopsReached(score)
  if (score >= MAX_SCORE) return 'Sei arrivato alla casa di Ale a Varigotti!'
  if (reached === 0) return 'Sei rimasto vicino al carro.'
  if (reached === STOPS.length) return 'Ultima tappa superata: la casa di Ale a Varigotti era a un passo.'
  return `Hai superato la tappa ${reached} di ${STOPS.length}.`
}

/** From the rarest down, so the surprising answers come first. */
const TIERS_RAREST_FIRST = [...TIERS].reverse()

function ResultCard({ result, number }: { result: Result; number: number }) {
  const [open, setOpen] = useState(false)
  const panelId = `answers-${result.question.id}`
  return (
    <li className={`result tier-${result.outcome}`}>
      <div className="result-row">
        <span className="result-number">{number}</span>
        <span className="result-main">
          <span className="result-prompt">{result.question.prompt}</span>
          <span className="result-answer">
            {result.timedOut ? 'Tempo scaduto' : result.answer ? result.answer.label : result.typed ? `«${result.typed}»` : 'Passata'}
          </span>
        </span>
        <span className="result-tier">
          <span className="chip">{TIER_INFO[result.outcome].label}</span>
          <span className="result-points">+{TIER_INFO[result.outcome].points}</span>
        </span>
      </div>
      <button
        type="button"
        className={open ? 'answers-toggle open' : 'answers-toggle'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Nascondi le risposte' : `Vedi le ${result.question.answers.length} risposte possibili`}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9 L12 15 L18 9" />
        </svg>
      </button>
      {open && (
        <div className="answers" id={panelId}>
          {TIERS_RAREST_FIRST.map((tier) => {
            const answers = result.question.answers.filter((answer) => answer.tier === tier)
            if (answers.length === 0) return null
            return (
              <section key={tier} className={`answers-tier tier-${tier}`}>
                <h3 className="answers-head">
                  <span className="chip">{TIER_INFO[tier].label}</span>
                  <span className="answers-points">+{TIER_INFO[tier].points}</span>
                  <span className="answers-count">{answers.length}</span>
                </h3>
                <ul className="answers-list">
                  {answers.map((answer) => (
                    <li key={answer.label} className={answer === result.answer ? 'answer mine' : 'answer'}>
                      {answer.label}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </li>
  )
}

export function Summary({ results, onAgain, onHome }: { results: Result[]; onAgain: () => void; onHome: () => void }) {
  const score = results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
  // Start at the cart, then walk: the scene animates whenever its points change.
  const [walked, setWalked] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setWalked(score), 500)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <main className="screen summary">
      <Scene
        className="hero hero-tall"
        points={walked}
        msPer100={650}
        label={`L'omino è arrivato a ${score} punti su ${MAX_SCORE}`}
      />
      <div className="home-body">
        <p className="total">
          <strong>{score}</strong> / {MAX_SCORE}
        </p>
        <h1 className="destination">{destination(score)}</h1>
        <ol className="results">
          {results.map((result, index) => (
            <ResultCard key={result.question.id} result={result} number={index + 1} />
          ))}
        </ol>
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

const THEMES: Array<[ThemePref, string]> = [
  ['auto', 'Automatico'],
  ['light', 'Chiaro'],
  ['dark', 'Scuro'],
]

export function Settings({ bank, onBack }: { bank: Question[]; onBack: () => void }) {
  const saved = useSavedState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; problems: string[] } | null>(null)
  const [confirming, setConfirming] = useState<'reset' | 'remove' | null>(null)
  const played = bank.length - countFresh(bank, saved.seen)
  const [theme, setTheme] = useThemePref()

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
        <button type="button" className="link back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5 L8 12 L15 19" />
          </svg>
          Indietro
        </button>
        <p className="game-count">Impostazioni</p>
        <span />
      </header>

      <section className="panel">
        <h2>Aspetto</h2>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              className={theme === value ? 'on' : ''}
              onClick={() => setTheme(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="note">
          {theme === 'auto'
            ? 'Segue il tema del telefono: chiaro di giorno, scuro quando il telefono è in modalità scura.'
            : theme === 'light'
              ? 'Sempre chiaro: il manifesto al tramonto.'
              : 'Sempre scuro: il manifesto di notte.'}
        </p>
      </section>

      <section className="panel">
        <h2>Timer</h2>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Timer per ogni domanda</span>
            <span className="note">
              {saved.timerOn
                ? `Hai ${timerLabel(saved.timerSeconds)} per ognuna delle ${QUESTIONS_PER_GAME} domande. Se il tempo finisce, quella domanda conta come «${TIER_INFO.miss.label}».`
                : 'Nessuna fretta: pensa quanto vuoi.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Timer per ogni domanda"
            className="switch"
            checked={saved.timerOn}
            onChange={(event) => {
              const timerOn = event.target.checked
              update((current) => ({ ...current, timerOn }))
            }}
          />
        </label>
        {saved.timerOn && (
          <div className="segmented four" role="radiogroup" aria-label="Tempo per ogni domanda">
            {TIMER_CHOICES.map((seconds) => (
              <button
                key={seconds}
                type="button"
                role="radio"
                aria-checked={saved.timerSeconds === seconds}
                className={saved.timerSeconds === seconds ? 'on' : ''}
                onClick={() => update((current) => ({ ...current, timerSeconds: seconds }))}
              >
                {timerLabel(seconds)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Domande</h2>
        <p>
          {bank.length} domande in tutto: {builtIn.questions.length + derived.length} incluse nell'app e{' '}
          {saved.custom.length} caricate da te. Ne hai già giocate {played}.
        </p>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Ripeti le domande</span>
            <span className="note">
              {saved.repeat
                ? 'Quando le hai giocate tutte, ricapitano a partire da quelle viste da più tempo.'
                : 'Ogni domanda esce una volta sola. Quando finiscono, azzera i progressi per ricominciare.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Ripeti le domande"
            className="switch"
            checked={saved.repeat}
            onChange={(event) => {
              const repeat = event.target.checked
              update((current) => ({ ...current, repeat }))
            }}
          />
        </label>
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
