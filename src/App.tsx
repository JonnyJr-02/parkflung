import { useMemo, useState } from 'react'
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
  | { name: 'summary'; results: Result[] }

export function App() {
  const saved = useSavedState()
  const bank = useMemo(() => mergeBank(saved.custom), [saved.custom])
  const [view, setView] = useState<View>({ name: 'home' })

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
    setView({ name: 'summary', results })
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
    case 'summary':
      return <Summary results={view.results} onAgain={play} onHome={() => setView({ name: 'home' })} />
  }
}
