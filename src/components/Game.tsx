import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { matchAnswer, type Answer } from '../game/match'
import type { Question } from '../game/parse'
import { markSeen } from '../game/store'
import { MAX_SCORE, TIER_INFO, type Outcome } from '../game/tiers'
import { Diorama } from './Diorama'
import { Farflung } from './Farflung'
import { RarityMeter } from './RarityMeter'

export interface Result {
  question: Question
  /** What the player typed; empty when they passed. */
  typed: string
  outcome: Outcome
  /** The listed answer that was matched, when there is one. */
  answer?: Answer
}

type Phase =
  | { kind: 'ask' }
  | { kind: 'confirm'; answer: Answer }
  /** The rarity meter is climbing; the result is not counted yet. */
  | { kind: 'suspense'; result: Result }
  /** Full-screen gold for the rarest tier, before the walker moves. */
  | { kind: 'celebrate'; result: Result }
  | { kind: 'reveal' }

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

export function Game({
  questions,
  onFinish,
  onQuit,
}: {
  questions: Question[]
  onFinish: (results: Result[]) => void
  onQuit: () => void
}) {
  const [results, setResults] = useState<Result[]>([])
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const index = phase.kind === 'reveal' ? results.length - 1 : results.length
  const question = questions[index]!
  const score = results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
  const last = results[results.length - 1]
  const isLastQuestion = index === questions.length - 1

  useEffect(() => {
    if (phase.kind === 'ask') inputRef.current?.focus({ preventScroll: true })
    if (phase.kind === 'reveal') nextRef.current?.focus({ preventScroll: true })
  }, [phase.kind, index])

  function startSuspense(outcome: Outcome, answer?: Answer) {
    markSeen([question.id])
    inputRef.current?.blur()
    setPhase({ kind: 'suspense', result: { question, typed: typed.trim(), outcome, answer } })
  }

  function commit(result: Result) {
    setResults((current) => [...current, result])
    setPhase({ kind: 'reveal' })
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
    if (isLastQuestion) {
      onFinish(results)
      return
    }
    setTyped('')
    setPhase({ kind: 'ask' })
  }

  const answering = phase.kind === 'ask' || phase.kind === 'confirm'

  return (
    <main className="screen game">
      <header className="game-top">
        <button type="button" className="link" onClick={onQuit}>
          Esci
        </button>
        <p className="game-count" key={index}>
          Domanda {index + 1} di {questions.length}
        </p>
        <p className="game-score" aria-label={`${score} punti su ${MAX_SCORE}`}>
          {score}
          <small>/{MAX_SCORE}</small>
        </p>
      </header>

      <Diorama className="game-scene" points={score} showGain label={`L'omino è a ${score} punti su ${MAX_SCORE}`} />

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
            <p className="reveal-prompt">{last.question.prompt}</p>
            <p className="reveal-label">{TIER_INFO[last.outcome].label}</p>
            <p className="reveal-answer">
              {last.answer ? last.answer.label : last.typed ? `«${last.typed}» non è tra le risposte` : 'Hai passato'}
            </p>
            <p className="reveal-move">
              {TIER_INFO[last.outcome].points > 0
                ? `+${TIER_INFO[last.outcome].points} punti: l'omino avanza sul sentiero`
                : "L'omino resta fermo"}
            </p>
            <button ref={nextRef} type="button" className="btn" onClick={next}>
              {isLastQuestion ? 'Guarda dove sei arrivato' : 'Prossima domanda'}
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
    </main>
  )
}
