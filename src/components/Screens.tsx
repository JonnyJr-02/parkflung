import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { builtIn, countFresh, derived, mergeCustom } from '../game/bank'
import { parseUpload, type Question } from '../game/parse'
import { TIMER_CHOICES, timerLabel } from '../game/timer'
import { update, useSavedState } from '../game/store'
import { halfway, prizeInfo, rulesFor } from '../game/surprise'
import { ladderFor, maxQuestions, TARGETS, TIER_INFO, TIERS, worldOf, WORLDS } from '../game/tiers'
import type { Result } from './Game'
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
  if (!repeat && fresh === 0) {
    return 'Hai finito le domande nuove. Attiva «Ripeti le domande» nelle impostazioni, oppure azzera i progressi.'
  }
  if (!repeat) return `${fresh} domande nuove rimaste su ${total}. Le domande già giocate non ricapitano.`
  if (fresh > 0) return `${fresh} domande ancora mai giocate su ${total}.`
  return `Hai giocato tutte le ${total} domande: ora ricapitano, a partire da quelle viste da più tempo.`
}

export function Home({
  bank,
  onPlay,
  onNewGame,
  onSettings,
}: {
  bank: Question[]
  onPlay: () => void
  onNewGame: () => void
  onSettings: () => void
}) {
  const saved = useSavedState()
  const game = saved.current
  const target = game?.target ?? saved.target
  const fresh = countFresh(bank, saved.seen)
  const canStart = saved.repeat || fresh > 0
  const gameScore = game ? game.results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0) : 0
  const hardcore = game ? (game.hardcore ?? true) : saved.hardcore
  const rules = rulesFor(target, game?.surprise, hardcore)
  const world = game ? worldOf(gameScore, rules.goal) : 4
  const prize = game?.surprise?.prize
  const [confirmNew, setConfirmNew] = useState(false)

  return (
    <main className="screen home">
      <Scene
        className="hero"
        points={gameScore}
        target={rules.goal}
        world={world}
        surprise={game ? { at: halfway(target), used: !!game.surprise } : undefined}
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
        <p className="lede">
          Una domanda dopo l'altra: più la risposta è rara, più strada fai. Arrivi alla casa di Ale&nbsp;a&nbsp;Varigotti a{' '}
          {target}&nbsp;punti, se ce la fai in {rules.limit}&nbsp;domande.
          {hardcore ? ' Modalità hardcore.' : ''}
        </p>
        <div className="target-choice">
          <p className="target-label" id="target-label">
            {game ? 'Prossima partita: casa di Ale a' : 'Casa di Ale a'}
          </p>
          <div className="segmented two" role="radiogroup" aria-labelledby="target-label">
            {TARGETS.map((points) => (
              <button
                key={points}
                type="button"
                role="radio"
                aria-checked={saved.target === points}
                className={saved.target === points ? 'on' : ''}
                onClick={() => update((current) => ({ ...current, target: points }))}
              >
                {points} punti
              </button>
            ))}
          </div>
          <p className="note">
            Al massimo {maxQuestions(saved.target, saved.hardcore)} domande{saved.hardcore ? ' (hardcore)' : ''}. Cinque mondi lungo il sentiero, uno ogni {saved.target / 5} punti: temporale,
            pioggerella, nuvole e sole, sole e tramonto.
          </p>
        </div>
        {game ? (
          <>
            <p className="current-game">
              <span aria-hidden="true">{WORLDS[world]!.icon}</span> Partita in corso: <strong>{gameScore}</strong> su {rules.goal} punti
              · domande {Math.min(game.results.length, rules.limit)} di {rules.limit} · {WORLDS[world]!.name}
              {prize && <> · imprevisto: {prizeInfo(prize).title}</>}
            </p>
            <button type="button" className="btn" onClick={onPlay}>
              Continua la partita
            </button>
            {confirmNew ? (
              <button type="button" className="btn danger" onClick={onNewGame}>
                Sì, ricomincia da capo
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={() => setConfirmNew(true)}>
                Nuova partita
              </button>
            )}
          </>
        ) : canStart ? (
          <button type="button" className="btn" onClick={onNewGame}>
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

/** From the rarest down, so the surprising answers come first. */
const TIERS_RAREST_FIRST = [...TIERS].reverse()

function ResultCard({ result, number, hardcore }: { result: Result; number: number; hardcore: boolean }) {
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
            {result.retried && ' · 🃏 seconda risposta'}
          </span>
        </span>
        <span className="result-tier">
          <span className="chip">
            {!hardcore && result.outcome === 'miss' ? (result.timedOut ? 'Tempo scaduto' : 'Passata') : TIER_INFO[result.outcome].label}
          </span>
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

export function Summary({
  results,
  target,
  hardcore,
  onAgain,
  onHome,
}: {
  results: Result[]
  target: number
  hardcore: boolean
  onAgain: () => void
  onHome: () => void
}) {
  const score = Math.min(target, results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0))
  const arrived = score >= target
  const world = arrived ? 4 : worldOf(score, target)
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
        target={target}
        world={world}
        msPer100={650 * (500 / target)}
        label={arrived ? `L'omino è arrivato alla casa di Ale: ${score} punti su ${target}` : `L'omino si è fermato a ${score} punti su ${target}`}
      />
      <div className="home-body">
        <p className="total">
          <strong>{score}</strong> / {target}
        </p>
        <h1 className="destination">
          {arrived
            ? `Sei arrivato alla casa di Ale a Varigotti in ${results.length} ${results.length === 1 ? 'domanda' : 'domande'}!`
            : `Domande finite: ti sei fermato nel mondo ${WORLDS[world]!.icon} ${WORLDS[world]!.name}, a ${target - score} punti dalla casa di Ale.`}
        </h1>
        <p className="note">Sotto ogni domanda puoi aprire tutte le sue risposte possibili, fascia per fascia.</p>
        <ol className="results">
          {results.map((result, index) => (
            <ResultCard key={`${result.question.id}-${index}`} result={result} number={index + 1} hardcore={hardcore} />
          ))}
        </ol>
        <button type="button" className="btn" onClick={onAgain}>
          Nuova partita
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
        <h2>Modalità</h2>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Modalità hardcore</span>
            <span className="note">
              {saved.hardcore
                ? `Attiva: c'è anche «${TIER_INFO.miss.label}» (0 punti), si può passare la domanda e una risposta che non è tra quelle valide vale 0 punti. Partita a 500 punti in ${maxQuestions(500, true)} domande, a 1000 punti in ${maxQuestions(1000, true)}.`
                : `Spenta: non c'è «${TIER_INFO.miss.label}». Se scrivi una risposta che non è tra quelle valide te lo dico e riprovi finché ne trovi una giusta. Se passi, o se finisce il tempo, quella domanda vale 0 punti. Per questo le domande sono il 25% in meno: ${maxQuestions(500, false)} invece di ${maxQuestions(500, true)} a 500 punti, ${maxQuestions(1000, false)} invece di ${maxQuestions(1000, true)} a 1000 punti.`}
              {saved.current ? ' Vale dalla prossima partita.' : ''}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Modalità hardcore"
            className="switch"
            checked={saved.hardcore}
            onChange={(event) => {
              const hardcore = event.target.checked
              update((current) => ({ ...current, hardcore }))
            }}
          />
        </label>
      </section>

      <section className="panel">
        <h2>Timer</h2>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Timer per ogni domanda</span>
            <span className="note">
              {saved.timerOn
                ? `Hai ${timerLabel(saved.timerSeconds)} per ogni domanda. Se il tempo finisce, quella domanda ${saved.hardcore ? `conta come «${TIER_INFO.miss.label}»` : 'vale 0 punti'}.`
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
        <h2>Suoni</h2>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Effetti sonori</span>
            <span className="note">
              {saved.soundOn
                ? "Il termometro che sale, le fasce, i passi dell'omino, la ruota della fortuna, i fuochi d'artificio."
                : 'Spenti: il gioco non fa nessun effetto sonoro.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Effetti sonori"
            className="switch"
            checked={saved.soundOn}
            onChange={(event) => {
              const soundOn = event.target.checked
              update((current) => ({ ...current, soundOn }))
            }}
          />
        </label>
        <label className="switch-row">
          <span className="switch-text">
            <span className="switch-title">Musica e ambienti</span>
            <span className="note">
              {saved.musicOn
                ? 'La musichetta nella Home e i suoni dei mondi: pioggia e tuoni, vento, uccellini, onde e gabbiani.'
                : 'Spenti: niente musica e niente suoni dei mondi.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Musica e ambienti"
            className="switch"
            checked={saved.musicOn}
            onChange={(event) => {
              const musicOn = event.target.checked
              update((current) => ({ ...current, musicOn }))
            }}
          />
        </label>
        <p className="note">Sul telefono i suoni partono dopo il primo tocco. Con il telefono in silenzioso potresti non sentirli.</p>
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
                : 'Ogni domanda esce una volta sola. Se finiscono a metà partita ricapitano le più vecchie; poi azzera i progressi per ricominciare.'}
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
          {ladderFor(saved.hardcore).map((outcome) => (
            <li key={outcome} className={`tier-${outcome}`}>
              <span className="chip">{TIER_INFO[outcome].label}</span>
              <span className="legend-rarity">{TIER_INFO[outcome].rarity}</span>
              <span className="legend-points">{TIER_INFO[outcome].points}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          Ogni risposta fa avanzare l'omino dei suoi punti, fino alla casa di Ale a {saved.target} punti. C'è una tappa, e un
          mondo nuovo, ogni {saved.target / 5} punti.
        </p>
      </section>

      <section className="panel">
        <h2>Progressi</h2>
        <p>Azzera partite, record, la partita in corso e l'elenco delle domande già giocate. Le domande caricate restano.</p>
        {confirming === 'reset' ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              update((current) => ({ ...current, seen: {}, games: [], current: null }))
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
