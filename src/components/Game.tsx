import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { matchAnswer, type Answer } from '../game/match'
import type { Question } from '../game/parse'
import { markSeen } from '../game/store'
import { cardLabel, halfway, rulesFor, type Surprise } from '../game/surprise'
import { ladderFor, stopsFor, swapsFor, TIER_INFO, worldOf, WORLDS, type Outcome } from '../game/tiers'
import { Farflung } from './Farflung'
import { RarityMeter } from './RarityMeter'
import { SecondChance, SurpriseSquare } from './Surprise'
import { Timer } from './Timer'
import { WeatherStrip } from './Weather'
import { WorldDone } from './WorldDone'
import { WalkOverlay } from './WalkOverlay'

export interface Result {
  question: Question
  /** What the player typed; empty when they passed. */
  typed: string
  outcome: Outcome
  /** The listed answer that was matched, when there is one. */
  answer?: Answer
  /** The timer ran out before an answer was sent: it counts as a miss. */
  timedOut?: boolean
  /** Answered a second time with the Carta Rivincita. */
  retried?: boolean
}

type Phase =
  | { kind: 'ask' }
  | { kind: 'confirm'; answer: Answer }
  /** The rarity meter is climbing; the result is not counted yet. */
  | { kind: 'suspense'; result: Result }
  /** Full-screen gold for the rarest tier, before the walker moves. */
  | { kind: 'celebrate'; result: Result }
  /** Full-screen walk to the new score. */
  | { kind: 'walk'; from: number; outcome: Outcome }
  /** Full-screen celebration: the walker has just left a world for the next one. */
  | { kind: 'world'; world: number }
  /** The "?" square halfway: go on or spin the wheel; then the recap (or the question, on a game picked up again). */
  | { kind: 'surprise'; then: 'reveal' | 'ask' }
  /** A miss with the Carta Rivincita in hand: answer again or keep it. */
  | { kind: 'second'; result: Result }
  | { kind: 'reveal' }

/** A thin trail along the top: where the walker is, the four stops and the "?" square. */
function Track({ score, target, surprise }: { score: number; target: number; surprise: { at: number; used: boolean } }) {
  const at = Math.min(1, score / target)
  return (
    <div className="track" aria-hidden="true">
      <span className="track-line" />
      <span className="track-fill" style={{ transform: `scaleX(${at})` }} />
      {stopsFor(target).map((stop) => (
        <span key={stop} className={score >= stop ? 'track-stop reached' : 'track-stop'} style={{ left: `${(stop / target) * 100}%` }} />
      ))}
      <span
        className={surprise.used ? 'track-surprise used' : 'track-surprise'}
        style={{ left: `${Math.min(1, surprise.at / target) * 100}%` }}
      >
        ?
      </span>
      <span className="track-walker" style={{ left: `${at * 100}%` }} />
      <span className="track-house" />
    </div>
  )
}

/** The question, word by word: each word rises in with a short stagger. */
function Prompt({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <h1 className="prompt" aria-label={text}>
      {words.map((word, index) => (
        <span key={index} className="prompt-word" aria-hidden="true" style={{ '--i': index } as CSSProperties}>
          {word}{' '}
        </span>
      ))}
    </h1>
  )
}

export function scoreOf(results: readonly Result[]): number {
  return results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
}

/**
 * A game: one question after another until the walker reaches the house of Ale at `target`
 * points, or the questions run out (20 for 500 points, 40 for 1000). Halfway there is the "?"
 * square, whose wheel of fortune can move the house, change the number of questions or give the
 * Carta Rivincita. Every answer is saved, so the game can be left and picked up again.
 */
export function Game({
  target,
  hardcore,
  timer,
  start,
  nextQuestion,
  onSave,
  onFinish,
  onQuit,
}: {
  target: number
  /**
   * Hardcore: misses exist and you can pass. Without it there are no misses: an answer that is not
   * listed asks you to try again, and a question whose time runs out is worth 0 points.
   */
  hardcore: boolean
  /** Seconds for each question, 0 for no timer. */
  timer: number
  /** What was already answered (when picking up a saved game), the question to show now and the "?" square. */
  start: { results: Result[]; question: Question; surprise?: Surprise; retried?: string; swapped: Question[] }
  nextQuestion: (asked: Question[]) => Question
  onSave: (
    results: Result[],
    onScreen: Question | null,
    extra: { surprise?: Surprise; retried?: string; swapped?: string[] },
  ) => void
  /** The game is over: the house reached at `goal` points, or the questions ran out. */
  onFinish: (results: Result[], goal: number) => void
  onQuit: () => void
}) {
  const [results, setResults] = useState<Result[]>(start.results)
  const [question, setQuestion] = useState<Question>(start.question)
  const [typed, setTyped] = useState('')
  const [surprise, setSurprise] = useState<Surprise | undefined>(start.surprise)
  /** The question on screen, once the Carta Rivincita was used on it. */
  const [retried, setRetried] = useState<string | undefined>(start.retried)
  /** The answer that the Carta Rivincita is trying to beat: kept if time runs out on the second try. */
  const [firstTry, setFirstTry] = useState<Result | undefined>(undefined)
  /** Without hardcore: the last answer typed that is not on the list. */
  const [notFound, setNotFound] = useState<string | null>(null)
  /** Questions swapped for another in this game: they do not come back. */
  const [swapped, setSwapped] = useState<Question[]>(start.swapped)
  // Picked up past the "?" square without having met it (left during the choice): it comes first.
  const [phase, setPhase] = useState<Phase>(() =>
    !start.surprise && scoreOf(start.results) >= halfway(target) && scoreOf(start.results) < target
      ? { kind: 'surprise', then: 'ask' }
      : { kind: 'ask' },
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const score = scoreOf(results)
  const last = results[results.length - 1]
  const { goal, limit, card } = rulesFor(target, surprise, hardcore)
  const ladder = ladderFor(hardcore)
  const half = halfway(target)
  const arrived = score >= goal
  /** The game is over after this answer: the house is reached or that was the last question. */
  const over = arrived || results.length >= limit
  const needsSurprise = !surprise && score >= half && !arrived
  const committed =
    phase.kind === 'reveal' || phase.kind === 'walk' || phase.kind === 'world' || (phase.kind === 'surprise' && phase.then === 'reveal')
  const number = committed ? results.length : results.length + 1
  const world = worldOf(score, goal)
  const secondTry = retried === question.id
  const attemptKey = secondTry ? `${question.id}-2` : question.id

  useEffect(() => {
    if (phase.kind === 'ask') inputRef.current?.focus({ preventScroll: true })
    if (phase.kind === 'reveal') nextRef.current?.focus({ preventScroll: true })
  }, [phase.kind, attemptKey])

  function startSuspense(outcome: Outcome, answer?: Answer) {
    markSeen([question.id])
    inputRef.current?.blur()
    setPhase({ kind: 'suspense', result: { question, typed: typed.trim(), outcome, answer, retried: secondTry || undefined } })
  }

  /**
   * Time is up on this question: whatever was typed, it is a miss in hardcore. Without hardcore it
   * is worth 0 points, straight to the recap (or the answer the card was trying to beat stays).
   */
  function timeUp() {
    if (phase.kind !== 'ask' && phase.kind !== 'confirm') return
    markSeen([question.id])
    inputRef.current?.blur()
    const result: Result = { question, typed: '', outcome: 'miss', timedOut: true, retried: secondTry || undefined }
    if (hardcore) setPhase({ kind: 'suspense', result })
    else zeroPoints(result)
  }

  /** «Non mi viene niente, passo»: a miss in hardcore, 0 points without it. */
  function pass() {
    if (hardcore) {
      startSuspense('miss')
      return
    }
    markSeen([question.id])
    inputRef.current?.blur()
    zeroPoints({ question, typed: '', outcome: 'miss', retried: secondTry || undefined })
  }

  /**
   * Without hardcore, a pass or the end of the time is worth 0 points, straight to the recap. On the
   * second try with the card, the first answer stays instead.
   */
  function zeroPoints(result: Result) {
    commit(secondTry && firstTry ? { ...firstTry, retried: true } : result)
  }

  /** The meter has stopped: Marco B. gets its party, the lowest rarity can be answered again with the card. */
  function afterMeter(result: Result) {
    if (result.outcome === 't') setPhase({ kind: 'celebrate', result })
    else if (result.outcome === ladder[0] && card && !secondTry) setPhase({ kind: 'second', result })
    else commit(result)
  }

  function retry(first: Result) {
    setFirstTry(first)
    setRetried(question.id)
    onSave(results, question, { surprise, retried: question.id })
    setTyped('')
    setPhase({ kind: 'ask' })
  }

  /** After the walk: a world left behind gets its show, then the "?" square if the walker just got there. */
  function afterWalk(from: number) {
    const left = worldOf(from, goal)
    if (score < goal && worldOf(score, goal) > left) setPhase({ kind: 'world', world: left })
    else afterWorld()
  }

  function afterWorld() {
    setPhase(needsSurprise ? { kind: 'surprise', then: 'reveal' } : { kind: 'reveal' })
  }

  function meetSurprise(prize: Surprise['prize'], then: 'reveal' | 'ask') {
    const met = { prize }
    setSurprise(met)
    onSave(results, then === 'ask' ? question : null, { surprise: met, retried })
  }

  function commit(result: Result) {
    setFirstTry(undefined)
    const now = [...results, result]
    setResults(now)
    onSave(now, null, { surprise, retried: undefined })
    // Every answer that scores ends with the walker crossing the trail, full screen.
    setPhase(TIER_INFO[result.outcome].points > 0 ? { kind: 'walk', from: score, outcome: result.outcome } : { kind: 'reveal' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return
    const match = matchAnswer(typed, question.answers)
    if (match.kind === 'exact') startSuspense(match.answer.tier, match.answer)
    else if (match.kind === 'suggest') setPhase({ kind: 'confirm', answer: match.answer })
    else if (hardcore) startSuspense('miss')
    else {
      // No misses without hardcore: say so and let the player try again.
      setNotFound(typed.trim())
      inputRef.current?.select()
    }
  }

  function next() {
    if (over) {
      onFinish(results, goal)
      return
    }
    const upcoming = nextQuestion([...results.map((result) => result.question), ...swapped])
    setRetried(undefined)
    onSave(results, upcoming, { surprise, retried: undefined })
    setQuestion(upcoming)
    setTyped('')
    setNotFound(null)
    setPhase({ kind: 'ask' })
  }

  const answering = phase.kind === 'ask' || phase.kind === 'confirm'
  const maxSwaps = swapsFor(target)
  const swapsLeft = Math.max(0, maxSwaps - swapped.length)
  /** Not on the second try with the card: the first answer would be lost. */
  const canSwap = phase.kind === 'ask' && swapsLeft > 0 && !secondTry

  /** «Cambia domanda»: another question in the same place, a few times per game. */
  function swapQuestion() {
    if (!canSwap) return
    markSeen([question.id])
    const now = [...swapped, question]
    const upcoming = nextQuestion([...results.map((result) => result.question), ...now])
    setSwapped(now)
    onSave(results, upcoming, { surprise, retried: undefined, swapped: now.map((item) => item.id) })
    setQuestion(upcoming)
    setTyped('')
    setNotFound(null)
  }

  return (
    <main className={timer > 0 ? 'screen game has-timer' : 'screen game'}>
      {timer > 0 && <Timer key={attemptKey} seconds={timer} running={answering} onExpire={timeUp} />}
      {answering && (
        <button
          type="button"
          className={swapsLeft > 0 ? 'swap' : 'swap empty'}
          onClick={swapQuestion}
          disabled={!canSwap}
          aria-label={`Cambia domanda: ${swapsLeft} cambi rimasti su ${maxSwaps}`}
          title="Cambia domanda"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path className="swap-arrow" d="M6 13 A10 10 0 0 1 24 9" />
            <path className="swap-head" d="M25.5 3.5 L24.5 10 L18 9" />
            <path className="swap-arrow" d="M26 19 A10 10 0 0 1 8 23" />
            <path className="swap-head" d="M6.5 28.5 L7.5 22 L14 23" />
          </svg>
          <span className="swap-count">
            {swapsLeft}/{maxSwaps}
          </span>
        </button>
      )}
      <header className="game-top">
        <button type="button" className="link" onClick={onQuit}>
          Esci
        </button>
        <p
          className={number === limit ? 'game-count last' : 'game-count'}
          key={number}
          aria-label={`Domanda ${number} di ${limit}, mondo ${WORLDS[world]!.name}`}
        >
          <span aria-hidden="true">{WORLDS[world]!.icon}</span> Domanda {number}
          <small> di {limit}</small>
        </p>
        <p className="game-score" aria-label={`${Math.min(score, goal)} punti su ${goal}`}>
          {Math.min(score, goal)}
          <small>/{goal}</small>
        </p>
      </header>

      <Track score={score} target={goal} surprise={{ at: half, used: !!surprise }} />
      {card && (
        <p className="card-badge" title={`Dopo ${cardLabel(hardcore)} puoi rispondere di nuovo, una volta per domanda`}>
          🃏 Carta Rivincita
        </p>
      )}

      <div className="game-body">
        {answering && (
          <div className="ask" key={attemptKey}>
            {secondTry && <p className="second-note">🃏 Seconda risposta con la Carta Rivincita</p>}
            <Prompt text={question.prompt} />
            <form className="answer-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="answer">
                La tua risposta
              </label>
              <input
                id="answer"
                ref={inputRef}
                className="answer-input"
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value)
                  setNotFound(null)
                }}
                placeholder="Scrivi una risposta"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                maxLength={60}
                disabled={phase.kind === 'confirm'}
              />
              <button type="submit" className="btn" disabled={!typed.trim() || phase.kind === 'confirm'}>
                Invia
              </button>
              {notFound && (
                <p className="not-found" role="alert">
                  «{notFound}» non c'è tra le risposte: riprova!
                </p>
              )}
              <button type="button" className="link pass" onClick={pass} disabled={phase.kind === 'confirm'}>
                Non mi viene niente, passo
              </button>
            </form>
          </div>
        )}

        {phase.kind === 'suspense' && (
          <RarityMeter
            key={question.id}
            outcome={phase.result.outcome}
            ladder={ladder}
            typed={phase.result.answer?.label ?? phase.result.typed}
            onDone={() => afterMeter(phase.result)}
          />
        )}

        {phase.kind === 'reveal' && last && (
          <section className={`reveal tier-${last.outcome}`} aria-live="polite">
            <WeatherStrip world={world} arrived={arrived} />
            <p className="reveal-prompt">{last.question.prompt}</p>
            <p className="reveal-label">
              {!hardcore && last.outcome === 'miss' ? (last.timedOut ? 'Tempo scaduto' : 'Hai passato') : TIER_INFO[last.outcome].label}
            </p>
            <p className="reveal-answer">
              {!hardcore && last.outcome === 'miss'
                ? 'Questa domanda vale 0 punti'
                : last.timedOut
                  ? 'Tempo scaduto!'
                  : last.answer
                  ? last.answer.label
                  : last.typed
                    ? `«${last.typed}» non è tra le risposte`
                    : 'Hai passato'}
            </p>
            {last.retried && <p className="reveal-card">🃏 Seconda risposta, con la Carta Rivincita</p>}
            <p className="reveal-move">
              {TIER_INFO[last.outcome].points > 0
                ? `+${TIER_INFO[last.outcome].points} punti · sei a ${Math.min(score, goal)} su ${goal}`
                : "Nessun passo avanti: l'omino resta fermo"}
            </p>
            {over && !arrived && <p className="reveal-last">Era l'ultima domanda: mancano {goal - score} punti alla casa di Ale.</p>}
            <button ref={nextRef} type="button" className="btn" onClick={next}>
              {arrived ? 'Entra nella casa di Ale' : over ? "Vedi com'è andata" : 'Prossima domanda'}
            </button>
          </section>
        )}
      </div>

      {phase.kind === 'confirm' && (
        <div className="sheet-backdrop">
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <p className="sheet-kicker">Hai scritto «{typed.trim()}»</p>
            <h2 id="confirm-title" className="sheet-title">
              Intendevi «{phase.answer.label}»?
            </h2>
            <button type="button" className="btn" autoFocus onClick={() => startSuspense(phase.answer.tier, phase.answer)}>
              Sì, invia
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase({ kind: 'ask' })}>
              No, riscrivo
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'celebrate' && <Farflung answer={phase.result.answer?.label ?? ''} onDone={() => commit(phase.result)} />}

      {phase.kind === 'walk' && (
        <WalkOverlay
          from={phase.from}
          to={score}
          target={goal}
          outcome={phase.outcome}
          surprise={{ at: half, used: !!surprise }}
          // A world completed on the way gets its own show; the last one is the house, after the recap.
          onDone={() => afterWalk(phase.from)}
        />
      )}

      {phase.kind === 'world' && <WorldDone world={phase.world} target={goal} onDone={afterWorld} />}

      {phase.kind === 'surprise' && (
        <SurpriseSquare
          target={target}
          hardcore={hardcore}
          onSkip={() => {
            meetSurprise(null, phase.then)
            setPhase({ kind: phase.then })
          }}
          onPrize={(prize) => meetSurprise(prize, phase.then)}
          onDone={() => setPhase({ kind: phase.then })}
        />
      )}

      {phase.kind === 'second' && <SecondChance prompt={question.prompt} hardcore={hardcore} onRetry={() => retry(phase.result)} />}
    </main>
  )
}
