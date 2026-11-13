import { useMemo, useState } from 'react'
import { Finale } from './components/Finale'
import { Game, type Result } from './components/Game'
import { Home, Settings, Summary } from './components/Screens'
import { mergeBank, pickQuestions } from './game/bank'
import type { Question } from './game/parse'
import { getState, recordGame, useSavedState } from './game/store'
import { QUESTIONS_PER_GAME, TIER_INFO } from './game/tiers'

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'game'; id: number; questions: Question[]; timer: number }
  /** The full-screen ending, then the summary. */
  | { name: 'finale'; results: Result[] }
  | { name: 'summary'; results: Result[] }

/** In development, `?finale=430` opens the ending with that score, to try every version of it. */
function firstView(): View {
  if (!import.meta.env.DEV) return { name: 'home' }
  const points = new URLSearchParams(location.search).get('finale')
  if (points === null) return { name: 'home' }
  const outcomes = Array.from({ length: 5 }, (_, i): Result['outcome'] => {
    const left = Number(points) - i * 100
    return left >= 100 ? 't' : left >= 75 ? 'e' : left >= 50 ? 'r' : left >= 25 ? 'n' : left >= 10 ? 'c' : 'miss'
  })
  return {
    name: 'finale',
    results: outcomes.map((outcome, i) => ({ question: { id: `prova-${i}`, prompt: `Domanda di prova ${i + 1}`, answers: [] }, typed: '', outcome })),
  }
}

export function App() {
  const saved = useSavedState()
  const bank = useMemo(() => mergeBank(saved.custom), [saved.custom])
  const [view, setView] = useState<View>(firstView)

  function play() {
    const { seen, repeat, timerOn, timerSeconds } = getState()
    const questions = pickQuestions(bank, seen, QUESTIONS_PER_GAME, repeat)
    // With repetition off and the new questions used up, Home explains what to do.
    if (questions.length < QUESTIONS_PER_GAME) setView({ name: 'home' })
    else setView({ name: 'game', id: Date.now(), questions, timer: timerOn ? timerSeconds : 0 })
  }

  function finish(results: Result[]) {
    recordGame({
      at: Date.now(),
      score: results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0),
      outcomes: results.map((result) => result.outcome),
    })
    setView({ name: 'finale', results })
  }

  switch (view.name) {
    case 'home':
      return <Home bank={bank} onPlay={play} onSettings={() => setView({ name: 'settings' })} />
    case 'settings':
      return <Settings bank={bank} onBack={() => setView({ name: 'home' })} />
    case 'game':
      return (
        <Game
          key={view.id}
          questions={view.questions}
          timer={view.timer}
          onFinish={finish}
          onQuit={() => setView({ name: 'home' })}
        />
      )
    case 'finale':
      return (
        <Finale
          score={view.results.reduce((sum, result) => sum + TIER_INFO[result.outcome].points, 0)}
          onDone={() => setView({ name: 'summary', results: view.results })}
        />
      )
    case 'summary':
      return <Summary results={view.results} onAgain={play} onHome={() => setView({ name: 'home' })} />
  }
}
