import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { matchAnswer, type Answer } from '../game/match'
import type { Question } from '../game/parse'
import { markSeen } from '../game/store'
import { maxQuestions, stopsFor, TIER_INFO, worldOf, WORLDS, type Outcome } from '../game/tiers'
import { Farflung } from './Farflung'
import { RarityMeter } from './RarityMeter'
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
  | { kind: 'reveal' }

/** A thin trail along the top: where the walker is, and the four stops. */
function Track({ score, target }: { score: number; target: number }) {
  const at = Math.min(1, score / target)
  return (
    <div className="track" aria-hidden="true">
      <span className="track-line" />
      <span className="track-fill" style={{ transform: `scaleX(${at})` }} />
      {stopsFor(target).map((stop) => (
        <span key={stop} className={score >= stop ? 'track-stop reached' : 'track-stop'} style={{ left: `${(stop / target) * 100}%` }} />
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

export function scoreOf(results: readonly Result[]): number {
  return results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
}

/**
 * A game: one question after another until the walker reaches the house of Ale at `target`
 * points, or the questions run out (20 for 500 points, 40 for 1000). Every answer is saved, so
 * the game can be left and picked up again.
 */
export function Game({
  target,
  timer,
  start,
  nextQuestion,
  onSave,
  onFinish,
  onQuit,
}: {
  target: number
  /** Seconds for each question, 0 for no timer. */
  timer: number
  /** What was already answered (when picking up a saved game) and the question to show now. */
  start: { results: Result[]; question: Question }
  nextQuestion: (asked: Question[]) => Question
  onSave: (results: Result[], onScreen: Question | null) => void
  onFinish: (results: Result[]) => void
  onQuit: () => void
}) {
  const [results, setResults] = useState<Result[]>(start.results)
  const [question, setQuestion] = useState<Question>(start.question)
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const score = scoreOf(results)
  const last = results[results.length - 1]
  const arrived = score >= target
  const limit = maxQuestions(target)
  /** The game is over after this answer: the house is reached or that was the last question. */
  const over = arrived || results.length >= limit
  const committed = phase.kind === 'reveal' || phase.kind === 'walk' || phase.kind === 'world'
  const number = committed ? results.length : results.length + 1
  const world = worldOf(score, target)

  useEffect(() => {
    if (phase.kind === 'ask') inputRef.current?.focus({ preventScroll: true })
    if (phase.kind === 'reveal') nextRef.current?.focus({ preventScroll: true })
  }, [phase.kind, question.id])

  function startSuspense(outcome: Outcome, answer?: Answer) {
    markSeen([question.id])
    inputRef.current?.blur()
    setPhase({ kind: 'suspense', result: { question, typed: typed.trim(), outcome, answer } })
  }

  /** Time is up on this question: whatever was typed, it is a miss. */
  function timeUp() {
    if (phase.kind !== 'ask' && phase.kind !== 'confirm') return
    markSeen([question.id])
    inputRef.current?.blur()
    setPhase({ kind: 'suspense', result: { question, typed: '', outcome: 'miss', timedOut: true } })
  }

  function commit(result: Result) {
    const now = [...results, result]
    setResults(now)
    onSave(now, null)
    // Every answer that scores ends with the walker crossing the trail, full screen.
    setPhase(TIER_INFO[result.outcome].points > 0 ? { kind: 'walk', from: score, outcome: result.outcome } : { kind: 'reveal' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return
    const match = matchAnswer(typed, question.answers)
    if (match.kind === 'exact') startSuspense(match.answer.tier, match.answer)
    else if (match.kind === 'suggest') setPhase({ kind: 'confirm', answer: match.answer })
    else startSuspense('miss')
  }

  function next() {
    if (over) {
      onFinish(results)
      return
    }
    const upcoming = nextQuestion(results.map((result) => result.question))
    onSave(results, upcoming)
    setQuestion(upcoming)
    setTyped('')
    setPhase({ kind: 'ask' })
  }

  const answering = phase.kind === 'ask' || phase.kind === 'confirm'

  return (
    <main className={timer > 0 ? 'screen game has-timer' : 'screen game'}>
      {timer > 0 && <Timer key={question.id} seconds={timer} running={answering} onExpire={timeUp} />}
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
        <p className="game-score" aria-label={`${Math.min(score, target)} punti su ${target}`}>
          {Math.min(score, target)}
          <small>/{target}</small>
        </p>
      </header>

      <Track score={score} target={target} />

      <div className="game-body">
        {answering && (
          <div className="ask" key={question.id}>
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
                onChange={(event) => setTyped(event.target.value)}
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
              <button type="button" className="link pass" onClick={() => startSuspense('miss')} disabled={phase.kind === 'confirm'}>
                Non mi viene niente, passo
              </button>
            </form>
          </div>
        )}

        {phase.kind === 'suspense' && (
          <RarityMeter
            key={question.id}
            outcome={phase.result.outcome}
            typed={phase.result.answer?.label ?? phase.result.typed}
            onDone={() =>
              phase.result.outcome === 't' ? setPhase({ kind: 'celebrate', result: phase.result }) : commit(phase.result)
            }
          />
        )}

        {phase.kind === 'reveal' && last && (
          <section className={`reveal tier-${last.outcome}`} aria-live="polite">
            <WeatherStrip world={world} arrived={arrived} />
            <p className="reveal-prompt">{last.question.prompt}</p>
            <p className="reveal-label">{TIER_INFO[last.outcome].label}</p>
            <p className="reveal-answer">
              {last.timedOut
                ? 'Tempo scaduto!'
                : last.answer
                  ? last.answer.label
                  : last.typed
                    ? `«${last.typed}» non è tra le risposte`
                    : 'Hai passato'}
            </p>
            <p className="reveal-move">
              {TIER_INFO[last.outcome].points > 0
                ? `+${TIER_INFO[last.outcome].points} punti · sei a ${Math.min(score, target)} su ${target}`
                : "Nessun passo avanti: l'omino resta fermo"}
            </p>
            {over && !arrived && <p className="reveal-last">Era l'ultima domanda: mancano {target - score} punti alla casa di Ale.</p>}
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
          target={target}
          outcome={phase.outcome}
          onDone={() => {
            // A world completed on the way gets its own show; the last one is the house, after the recap.
            const left = worldOf(phase.from, target)
            setPhase(score < target && worldOf(score, target) > left ? { kind: 'world', world: left } : { kind: 'reveal' })
          }}
        />
      )}

      {phase.kind === 'world' && <WorldDone world={phase.world} target={target} onDone={() => setPhase({ kind: 'reveal' })} />}
    </main>
  )
}
