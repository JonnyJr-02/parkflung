import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { builtIn, countFresh, derived, mergeCustom } from '../game/bank'
import { parseUpload, type Question } from '../game/parse'
import { TIMER_CHOICES, timerLabel } from '../game/timer'
import { update, useSavedState } from '../game/store'
import { rulesFor } from '../game/surprise'
import { ladderFor, maxQuestions, stepOf, SWAPS, TIER_INFO, TIERS } from '../game/tiers'
import { isUnlocked, WORLDS, type WorldId, type WorldInfo } from '../game/worlds'
import { scoreOf, type Result } from './Game'
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

const PLAY_LABEL: Record<WorldId, string> = {
  parcheggio: 'Gioca al Parcheggio',
  tigros: 'Gioca al Tigros',
  casa: 'Gioca alla Casa di Ale',
  varigotti: 'Gioca a Varigotti',
  decanter: 'Gioca al Decanter',
}

/** The step shown on the home poster of a world with no game in progress: its most typical sky. */
const COVER_STEP: Record<WorldId, number> = { parcheggio: 3, tigros: 3, casa: 4, varigotti: 4, decanter: 3 }

function WorldCard({
  world,
  index,
  hardcore,
  canStart,
  onPlay,
  onNewGame,
  onSettings,
}: {
  world: WorldInfo
  index: number
  hardcore: boolean
  canStart: boolean
  onPlay: () => void
  onNewGame: () => void
  onSettings: () => void
}) {
  const saved = useSavedState()
  const game = saved.playing[world.id]
  const locked = !isUnlocked(world.id, saved.reached)
  const reached = saved.reached.includes(world.id)
  const gameHardcore = game ? game.hardcore === true : hardcore
  const rules = rulesFor(world.target, game?.met, gameHardcore)
  const score = game ? scoreOf(game.results) : 0
  const step = game ? stepOf(score, rules.goal) : COVER_STEP[world.id]
  const stepInfo = world.steps[step]!
  const previous = WORLDS[index - 1]
  const [confirmNew, setConfirmNew] = useState(false)

  return (
    <section className={locked ? 'world-card locked' : 'world-card'} aria-label={`Mondo ${index + 1} di 5: ${world.name}${locked ? ', bloccato' : ''}`}>
      <Scene
        className="hero world-hero"
        world={world.id}
        sky={stepInfo.sky}
        wobble={game ? stepInfo.wobble : 0}
        walker={world.walker}
        points={score}
        target={rules.goal}
        spots={world.spots.map((spot, n) => ({ at: spot.at, used: game?.met?.[n] !== undefined }))}
        label={`${world.name}: ${world.tagline}`}
      >
        {locked && (
          <span className="world-lock" aria-hidden="true">
            🔒
          </span>
        )}
      </Scene>
      <div className="world-info">
        <p className="world-number">Mondo {index + 1} di 5</p>
        <h2 className="world-name">
          <span aria-hidden="true">{world.icon}</span> {world.name}
        </h2>
        <p className="world-tagline">{world.tagline}</p>
        <p className="world-facts">
          {world.target} punti · {maxQuestions(world.target, hardcore)} domande · {world.spots.length}{' '}
          {world.spots.length === 1 ? 'imprevisto' : 'imprevisti'} · {SWAPS} cambi
        </p>
        <p className="world-steps" aria-label={`Step: ${world.steps.map((item) => item.name).join(', ')}`}>
          {world.steps.map((item) => (
            <span key={item.name} title={item.name}>
              {item.icon}
            </span>
          ))}
          <span title="Traguardo">🏁</span>
        </p>
        {locked ? (
          <p className="world-locked">
            🔒 Arriva {previous?.arrival.to} (mondo {index}) per sbloccarlo.
          </p>
        ) : game ? (
          <>
            <p className="current-game">
              <span aria-hidden="true">{stepInfo.icon}</span> Partita in corso: <strong>{score}</strong> su {rules.goal} punti · domande{' '}
              {Math.min(game.results.length, rules.limit)} di {rules.limit} · {stepInfo.name}
              {gameHardcore ? ' · hardcore' : ''}
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
            {PLAY_LABEL[world.id]}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onSettings}>
            Apri le impostazioni
          </button>
        )}
        {reached && <p className="world-reached">🏁 Traguardo già raggiunto</p>}
      </div>
    </section>
  )
}

/**
 * The home screen: the five worlds side by side, to swipe left and right. A world opens once the
 * arrival of the one before is reached; each keeps its own game in progress.
 */
export function Home({
  bank,
  onPlay,
  onNewGame,
  onSettings,
}: {
  bank: Question[]
  onPlay: (world: WorldId) => void
  onNewGame: (world: WorldId) => void
  onSettings: () => void
}) {
  const saved = useSavedState()
  const fresh = countFresh(bank, saved.seen)
  const canStart = saved.repeat || fresh > 0
  const scrollerRef = useRef<HTMLDivElement>(null)
  const shown = Math.max(0, WORLDS.findIndex((world) => world.id === saved.world))

  // Open on the world shown last time.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollLeft = shown * scroller.clientWidth
  }, [])

  function onScroll() {
    const scroller = scrollerRef.current
    if (!scroller) return
    const index = Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth))
    const world = WORLDS[Math.max(0, Math.min(WORLDS.length - 1, index))]!
    if (world.id !== saved.world) update((current) => ({ ...current, world: world.id }))
  }

  function go(index: number) {
    const scroller = scrollerRef.current
    if (!scroller) return
    const target = Math.max(0, Math.min(WORLDS.length - 1, index))
    scroller.scrollTo({ left: target * scroller.clientWidth, behavior: 'smooth' })
  }

  return (
    <main className="screen home worlds-home">
      <header className="home-top">
        <h1 className="title">
          Park<em>Flung</em>
        </h1>
        <button type="button" className="icon-button" onClick={onSettings} aria-label="Impostazioni">
          <GearIcon />
        </button>
      </header>
      <div className="worlds" ref={scrollerRef} onScroll={onScroll}>
        {WORLDS.map((world, index) => (
          <WorldCard
            key={world.id}
            world={world}
            index={index}
            hardcore={saved.hardcore}
            canStart={canStart}
            onPlay={() => onPlay(world.id)}
            onNewGame={() => onNewGame(world.id)}
            onSettings={onSettings}
          />
        ))}
      </div>
      <nav className="world-nav" aria-label="Scegli il mondo">
        <button type="button" className="world-arrow" onClick={() => go(shown - 1)} disabled={shown === 0} aria-label="Mondo precedente">
          ‹
        </button>
        {WORLDS.map((world, index) => (
          <button
            key={world.id}
            type="button"
            className={index === shown ? 'world-dot on' : 'world-dot'}
            onClick={() => go(index)}
            aria-label={world.name}
            aria-current={index === shown}
          >
            {isUnlocked(world.id, saved.reached) ? world.icon : '🔒'}
          </button>
        ))}
        <button
          type="button"
          className="world-arrow"
          onClick={() => go(shown + 1)}
          disabled={shown === WORLDS.length - 1}
          aria-label="Mondo successivo"
        >
          ›
        </button>
      </nav>
      <p className="note home-note">{homeNote(bank.length, fresh, saved.repeat)}</p>
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
  world: info,
  results,
  target,
  hardcore,
  onAgain,
  onHome,
  onEnd,
}: {
  world: WorldInfo
  results: Result[]
  target: number
  hardcore: boolean
  onAgain: () => void
  onHome: () => void
  /** The last world was finished: one button, on to the end of the game and its credits. */
  onEnd?: () => void
}) {
  const score = Math.min(target, scoreOf(results))
  const arrived = score >= target
  const step = info.steps[stepOf(score, target)]!
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
        world={info.id}
        sky={step.sky}
        walker={info.walker}
        points={walked}
        target={target}
        msPer100={650 * (500 / target)}
        label={arrived ? `${info.arrival.title} ${score} punti su ${target}` : `L'omino si è fermato a ${score} punti su ${target}`}
      />
      <div className="home-body">
        <p className="total">
          <strong>{score}</strong> / {target}
        </p>
        <h1 className="destination">
          {arrived
            ? `${info.arrival.title.replace(/!$/, '')} in ${results.length} ${results.length === 1 ? 'domanda' : 'domande'}!`
            : `Domande finite: ti sei fermato allo step ${step.icon} ${step.name}, a ${target - score} punti ${info.arrival.to}.`}
        </h1>
        <p className="note">Sotto ogni domanda puoi aprire tutte le sue risposte possibili, fascia per fascia.</p>
        <ol className="results">
          {results.map((result, index) => (
            <ResultCard key={`${result.question.id}-${index}`} result={result} number={index + 1} hardcore={hardcore} />
          ))}
        </ol>
        {onEnd ? (
          <button type="button" className="btn" onClick={onEnd}>
            Continua
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onAgain}>
              Nuova partita
            </button>
            <button type="button" className="btn ghost" onClick={onHome}>
              Torna all'inizio
            </button>
          </>
        )}
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
                ? `Attiva: c'è anche «${TIER_INFO.miss.label}» (0 punti), si può passare la domanda e una risposta che non è tra quelle valide vale 0 punti. Una domanda ogni 25 punti: ${WORLDS.map((world) => maxQuestions(world.target, true)).join(', ')} domande, dal Parcheggio al Decanter.`
                : `Spenta: non c'è «${TIER_INFO.miss.label}». Se scrivi una risposta che non è tra quelle valide te lo dico e riprovi finché ne trovi una giusta. Se passi, o se finisce il tempo, quella domanda vale 0 punti. Per questo le domande sono il 25% in meno: ${WORLDS.map((world) => maxQuestions(world.target, false)).join(', ')} invece di ${WORLDS.map((world) => maxQuestions(world.target, true)).join(', ')}, dal Parcheggio al Decanter.`}
              {Object.keys(saved.playing).length > 0 ? ' Vale per le partite che inizi da adesso.' : ''}
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
                ? 'Il termometro che sale e un suono quando si sblocca uno step o un nuovo mondo.'
                : 'Spenti: niente termometro e niente suono di sblocco.'}
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
            <span className="switch-title">Musica</span>
            <span className="note">
              {saved.musicOn
                ? 'Una musica diversa per ogni mondo: nella Home cambia mentre scorri i mondi.'
                : 'Spenta: niente musica.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Musica"
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
          Ogni risposta fa avanzare l'omino dei suoi punti, fino al traguardo del mondo. Ogni mondo ha 5 step: se ne cambia
          ogni quinto di sentiero. Con la Carta Diamante i punti sono doppi.
        </p>
      </section>

      <section className="panel">
        <h2>Progressi</h2>
        <p>
          Azzera partite, record, le partite in corso, i mondi sbloccati e l'elenco delle domande già giocate. Le domande caricate
          restano.
        </p>
        {confirming === 'reset' ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              update((current) => ({ ...current, seen: {}, games: [], playing: {}, reached: [], world: WORLDS[0]!.id }))
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
