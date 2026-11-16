import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { matchAnswer, type Answer } from '../game/match'
import type { Question } from '../game/parse'
import { markSeen } from '../game/store'
import { cardLabel, rulesFor, type Met, type Prize } from '../game/surprise'
import { ladderFor, stepOf, stopsFor, SWAPS, TIER_INFO, type Outcome } from '../game/tiers'
import type { WorldInfo } from '../game/worlds'
import { Farflung } from './Farflung'
import { RarityMeter } from './RarityMeter'
import { StepDone } from './StepDone'
import { SecondChance, SurpriseSquare } from './Surprise'
import { Timer } from './Timer'
import { WeatherStrip } from './Weather'
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
  /** Worth double points: answered with the Carta Diamante. */
  double?: boolean
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
  /** Full-screen celebration: the walker has just got into a new step of the world. */
  | { kind: 'step'; step: number }
  /** A "?" square: its wheel; then the recap (or the question, on a game picked up again). */
  | { kind: 'surprise'; spot: number; then: 'reveal' | 'ask' }
  /** The lowest rarity with the Carta Rivincita in hand: answer again. */
  | { kind: 'second'; result: Result }
  | { kind: 'reveal' }

/** A thin trail along the top: where the walker is, the four stops and the "?" squares. */
function Track({ score, goal, spots }: { score: number; goal: number; spots: ReadonlyArray<{ at: number; used: boolean }> }) {
  const at = Math.min(1, score / goal)
  return (
    <div className="track" aria-hidden="true">
      <span className="track-line" />
      <span className="track-fill" style={{ transform: `scaleX(${at})` }} />
      {stopsFor(goal).map((stop) => (
        <span key={stop} className={score >= stop ? 'track-stop reached' : 'track-stop'} style={{ left: `${(stop / goal) * 100}%` }} />
      ))}
      {spots.map((spot) => (
        <span
          key={spot.at}
          className={spot.used ? 'track-surprise used' : 'track-surprise'}
          style={{ left: `${Math.min(1, spot.at / goal) * 100}%` }}
        >
          ?
        </span>
      ))}
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

/** Points of one answer: the rarity, doubled with the Carta Diamante. */
export function pointsOf(result: Pick<Result, 'outcome' | 'double'>): number {
  return TIER_INFO[result.outcome].points * (result.double ? 2 : 1)
}

export function scoreOf(results: ReadonlyArray<Pick<Result, 'outcome' | 'double'>>): number {
  return results.reduce((sum, result) => sum + pointsOf(result), 0)
}

/** The first "?" square the walker has got to without meeting it yet, or -1. */
function pendingSpot(world: WorldInfo, score: number, met: Met, goal: number): number {
  if (score >= goal) return -1
  return world.spots.findIndex((spot, index) => met[index] === undefined && score >= spot.at)
}

/**
 * A game in one world: one question after another until the walker reaches the arrival, or the
 * questions run out (one every 25 points). Along the trail are the "?" squares, whose wheels of
 * fortune move the arrival, change the number of questions or give a card. Every answer is
 * saved, so the game can be left and picked up again.
 */
export function Game({
  world,
  hardcore,
  timer,
  start,
  nextQuestion,
  onSave,
  onFinish,
  onQuit,
}: {
  world: WorldInfo
  /**
   * Hardcore: misses exist and you can pass. Without it there are no misses: an answer that is not
   * listed asks you to try again, and a question passed or out of time is worth 0 points.
   */
  hardcore: boolean
  /** Seconds for each question, 0 for no timer. */
  timer: number
  /** What was already answered (when picking up a saved game), the question to show now and the squares met. */
  start: { results: Result[]; question: Question; met: Met; retried?: string; swapped: Question[] }
  nextQuestion: (asked: Question[]) => Question
  onSave: (results: Result[], onScreen: Question | null, extra: { met?: Met; retried?: string; swapped?: string[] }) => void
  /** The game is over: the arrival reached at `goal` points, or the questions ran out. */
  onFinish: (results: Result[], goal: number) => void
  onQuit: () => void
}) {
  const [results, setResults] = useState<Result[]>(start.results)
  const [question, setQuestion] = useState<Question>(start.question)
  const [typed, setTyped] = useState('')
  const [met, setMet] = useState<Met>(start.met)
  /** The question on screen, once the Carta Rivincita was used on it. */
  const [retried, setRetried] = useState<string | undefined>(start.retried)
  /** The answer that the Carta Rivincita is trying to beat: kept if time runs out on the second try. */
  const [firstTry, setFirstTry] = useState<Result | undefined>(undefined)
  /** Without hardcore: the last answer typed that is not on the list. */
  const [notFound, setNotFound] = useState<string | null>(null)
  /** Questions swapped for another in this game: they do not come back. */
  const [swapped, setSwapped] = useState<Question[]>(start.swapped)
  // Picked up at a "?" square not met yet (left during the wheel): it comes first.
  const [phase, setPhase] = useState<Phase>(() => {
    const startRules = rulesFor(world.target, start.met, hardcore)
    const spot = pendingSpot(world, scoreOf(start.results), start.met, startRules.goal)
    return spot >= 0 ? { kind: 'surprise', spot, then: 'ask' } : { kind: 'ask' }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const score = scoreOf(results)
  const last = results[results.length - 1]
  const rules = rulesFor(world.target, met, hardcore)
  const { goal, limit, card, diamond } = rules
  const ladder = ladderFor(hardcore)
  const arrived = score >= goal
  /** The game is over after this answer: the arrival is reached or that was the last question. */
  const over = arrived || results.length >= limit
  const committed =
    phase.kind === 'reveal' || phase.kind === 'walk' || phase.kind === 'step' || (phase.kind === 'surprise' && phase.then === 'reveal')
  const number = committed ? results.length : results.length + 1
  const step = stepOf(score, goal)
  const stepInfo = world.steps[step]!
  const secondTry = retried === question.id
  const attemptKey = secondTry ? `${question.id}-2` : question.id
  const spots = world.spots.map((spot, index) => ({ at: spot.at, used: met[index] !== undefined }))

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

  /** Without hardcore, a pass or the end of the time is worth 0 points; on the card's second try the first answer stays. */
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
    onSave(results, question, { met, retried: question.id })
    setTyped('')
    setPhase({ kind: 'ask' })
  }

  /** After the walk: a new step gets its show, then a "?" square if the walker just got there. */
  function afterWalk(from: number) {
    const now = stepOf(score, goal)
    if (score < goal && now > stepOf(from, goal)) setPhase({ kind: 'step', step: now })
    else afterStep()
  }

  function afterStep() {
    const spot = pendingSpot(world, score, met, goal)
    setPhase(spot >= 0 ? { kind: 'surprise', spot, then: 'reveal' } : { kind: 'reveal' })
  }

  /** A square is met: its prize (or null when skipped) counts from now on. */
  function meetSurprise(spot: number, prize: Prize | null, then: 'reveal' | 'ask'): Met {
    const now = { ...met, [spot]: prize }
    setMet(now)
    onSave(results, then === 'ask' ? question : null, { met: now, retried })
    return now
  }

  /** After a wheel: another square reached at the same time comes next, then where the game was going. */
  function afterSurprise(now: Met, then: 'reveal' | 'ask') {
    const nextRules = rulesFor(world.target, now, hardcore)
    const spot = pendingSpot(world, score, now, nextRules.goal)
    setPhase(spot >= 0 ? { kind: 'surprise', spot, then } : { kind: then })
  }

  function commit(result: Result) {
    setFirstTry(undefined)
    const counted: Result = diamond ? { ...result, double: true } : result
    const now = [...results, counted]
    setResults(now)
    onSave(now, null, { met, retried: undefined })
    // Every answer that scores ends with the walker crossing the trail, full screen.
    setPhase(pointsOf(counted) > 0 ? { kind: 'walk', from: score, outcome: counted.outcome } : { kind: 'reveal' })
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
    onSave(results, upcoming, { met, retried: undefined })
    setQuestion(upcoming)
    setTyped('')
    setNotFound(null)
    setPhase({ kind: 'ask' })
  }

  const answering = phase.kind === 'ask' || phase.kind === 'confirm'
  const swapsLeft = Math.max(0, SWAPS - swapped.length)
  /** Not on the second try with the card: the first answer would be lost. */
  const canSwap = phase.kind === 'ask' && swapsLeft > 0 && !secondTry

  /** «Cambia domanda»: another question in the same place, five times per game. */
  function swapQuestion() {
    if (!canSwap) return
    markSeen([question.id])
    const now = [...swapped, question]
    const upcoming = nextQuestion([...results.map((result) => result.question), ...now])
    setSwapped(now)
    onSave(results, upcoming, { met, retried: undefined, swapped: now.map((item) => item.id) })
    setQuestion(upcoming)
    setTyped('')
    setNotFound(null)
  }

  const lastPoints = last ? pointsOf(last) : 0

  return (
    <main className={timer > 0 ? `screen game world-${world.id} has-timer` : `screen game world-${world.id}`}>
      {timer > 0 && <Timer key={attemptKey} seconds={timer} running={answering} onExpire={timeUp} />}
      {answering && (
        <button
          type="button"
          className={swapsLeft > 0 ? 'swap' : 'swap empty'}
          onClick={swapQuestion}
          disabled={!canSwap}
          aria-label={`Cambia domanda: ${swapsLeft} cambi rimasti su ${SWAPS}`}
          title="Cambia domanda"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path className="swap-arrow" d="M6 13 A10 10 0 0 1 24 9" />
            <path className="swap-head" d="M25.5 3.5 L24.5 10 L18 9" />
            <path className="swap-arrow" d="M26 19 A10 10 0 0 1 8 23" />
            <path className="swap-head" d="M6.5 28.5 L7.5 22 L14 23" />
          </svg>
          <span className="swap-count">
            {swapsLeft}/{SWAPS}
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
          aria-label={`${world.name}: domanda ${number} di ${limit}, step ${stepInfo.name}`}
        >
          <span aria-hidden="true">{stepInfo.icon}</span> Domanda {number}
          <small> di {limit}</small>
        </p>
        <p className="game-score" aria-label={`${Math.min(score, goal)} punti su ${goal}`}>
          {Math.min(score, goal)}
          <small>/{goal}</small>
        </p>
      </header>

      <Track score={score} goal={goal} spots={spots} />
      {(card || diamond) && (
        <p className="card-badges">
          {card && (
            <span className="card-badge" title={`Dopo ${cardLabel(hardcore)} puoi rispondere di nuovo, una volta per domanda`}>
              🃏 Carta Rivincita
            </span>
          )}
          {diamond && (
            <span className="card-badge diamond" title="Ogni risposta vale il doppio dei punti">
              💎 Punti doppi
            </span>
          )}
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
            <WeatherStrip world={world} step={step} arrived={arrived} />
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
              {lastPoints > 0
                ? `+${lastPoints} punti${last.double ? ' (doppi 💎)' : ''} · sei a ${Math.min(score, goal)} su ${goal}`
                : "Nessun passo avanti: l'omino resta fermo"}
            </p>
            {over && !arrived && (
              <p className="reveal-last">
                Era l'ultima domanda: mancano {goal - score} punti {world.arrival.to}.
              </p>
            )}
            <button ref={nextRef} type="button" className="btn" onClick={next}>
              {arrived ? world.arrival.enter : over ? "Vedi com'è andata" : 'Prossima domanda'}
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
          world={world}
          from={phase.from}
          to={score}
          goal={goal}
          outcome={phase.outcome}
          spots={spots}
          // A step reached on the way gets its own show; the arrival comes after the recap.
          onDone={() => afterWalk(phase.from)}
        />
      )}

      {phase.kind === 'step' && <StepDone world={world} step={phase.step} goal={goal} onDone={afterStep} />}

      {phase.kind === 'surprise' && (
        <SurpriseSquare
          key={phase.spot}
          spot={world.spots[phase.spot]!}
          hardcore={hardcore}
          rulesWith={(prize) => rulesFor(world.target, { ...met, [phase.spot]: prize }, hardcore)}
          onSkip={() => afterSurprise(meetSurprise(phase.spot, null, phase.then), phase.then)}
          onPrize={(prize) => meetSurprise(phase.spot, prize, phase.then)}
          onDone={() => afterSurprise(met, phase.then)}
        />
      )}

      {phase.kind === 'second' && <SecondChance prompt={question.prompt} hardcore={hardcore} onRetry={() => retry(phase.result)} />}
    </main>
  )
}
