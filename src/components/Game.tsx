import { useEffect, useRef, useState, type FormEvent } from 'react'
import { matchAnswer, type Answer } from '../game/match'
import type { Question } from '../game/parse'
import { markSeen } from '../game/store'
import { MAX_SCORE, STOPS, TIER_INFO, type Outcome } from '../game/tiers'
import { Farflung } from './Farflung'

export interface Result {
  question: Question
  /** What the player typed; empty when they passed. */
  typed: string
  outcome: Outcome
  /** The listed answer that was matched, when there is one. */
  answer?: Answer
}

type Phase = { kind: 'ask' } | { kind: 'confirm'; answer: Answer } | { kind: 'reveal' }

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
  const [celebrating, setCelebrating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const index = phase.kind === 'reveal' ? results.length - 1 : results.length
  const question = questions[index]!
  const score = results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)
  const last = results[results.length - 1]
  const isLastQuestion = index === questions.length - 1

  useEffect(() => {
    if (phase.kind === 'ask') inputRef.current?.focus()
    if (phase.kind === 'reveal' && !celebrating) nextRef.current?.focus()
  }, [phase.kind, celebrating, index])

  function reveal(outcome: Outcome, answer?: Answer) {
    markSeen([question.id])
    setResults((current) => [...current, { question, typed: typed.trim(), outcome, answer }])
    setPhase({ kind: 'reveal' })
    if (outcome === 't') setCelebrating(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return
    const match = matchAnswer(typed, question.answers)
    if (match.kind === 'exact') reveal(match.answer.tier, match.answer)
    else if (match.kind === 'suggest') setPhase({ kind: 'confirm', answer: match.answer })
    else reveal('miss')
  }

  function next() {
    if (isLastQuestion) {
      onFinish(results)
      return
    }
    setTyped('')
    setPhase({ kind: 'ask' })
  }

  return (
    <main className="screen game">
      <header className="game-top">
        <button type="button" className="link" onClick={onQuit}>
          Esci
        </button>
        <p className="game-count">
          Domanda {index + 1} di {questions.length}
        </p>
        <p className="game-score" aria-label={`${score} punti`}>
          {score}
        </p>
      </header>

      <div className="track" aria-hidden="true">
        <span className="track-fill" style={{ transform: `scaleX(${score / MAX_SCORE})` }} />
        {STOPS.map((stop) => (
          <span key={stop} className="track-stop" style={{ left: `${(stop / MAX_SCORE) * 100}%` }} />
        ))}
      </div>
      <div className="track-ends" aria-hidden="true">
        <span>Carro</span>
        <span>Casa gialla</span>
      </div>

      <h1 className="prompt" key={question.id}>
        {question.prompt}
      </h1>

      {phase.kind !== 'reveal' && (
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
          <button type="button" className="link pass" onClick={() => reveal('miss')} disabled={phase.kind === 'confirm'}>
            Non mi viene niente, passo
          </button>
        </form>
      )}

      {phase.kind === 'reveal' && last && !celebrating && (
        <section className={`reveal tier-${last.outcome}`} aria-live="polite">
          <p className="reveal-label">{TIER_INFO[last.outcome].label}</p>
          <p className="reveal-points">+{TIER_INFO[last.outcome].points} punti</p>
          <p className="reveal-answer">
            {last.answer
              ? last.answer.label
              : last.typed
                ? `«${last.typed}» non è tra le risposte`
                : 'Hai passato'}
          </p>
          <button ref={nextRef} type="button" className="btn" onClick={next}>
            {isLastQuestion ? 'Vai al sentiero' : 'Prossima domanda'}
          </button>
        </section>
      )}

      {phase.kind === 'confirm' && (
        <div className="sheet-backdrop">
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <p className="sheet-kicker">Hai scritto «{typed.trim()}»</p>
            <h2 id="confirm-title" className="sheet-title">
              Intendevi «{phase.answer.label}»?
            </h2>
            <button type="button" className="btn" autoFocus onClick={() => reveal(phase.answer.tier, phase.answer)}>
              Sì, invia
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase({ kind: 'ask' })}>
              No, riscrivo
            </button>
          </div>
        </div>
      )}

      {celebrating && last && <Farflung answer={last.answer?.label ?? ''} onDone={() => setCelebrating(false)} />}
    </main>
  )
}
