import { useMemo, useState } from 'react'
import { Finale } from './components/Finale'
import { Game, scoreOf, type Result } from './components/Game'
import { Home, Settings, Summary } from './components/Screens'
import { WorldDone } from './components/WorldDone'
import { mergeBank, pickNext } from './game/bank'
import type { Question } from './game/parse'
import { getState, recordGame, saveGame, useSavedState, type SavedGame, type SavedResult } from './game/store'
import { DEFAULT_TARGET, type Target } from './game/tiers'

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'game'; id: number; target: Target; timer: number; start: { results: Result[]; question: Question } }
  /** The arrival at the house of Ale, then the summary. */
  | { name: 'finale'; results: Result[]; target: Target }
  | { name: 'summary'; results: Result[]; target: Target }
  /** Development only: one world-completed show on its own. */
  | { name: 'world'; world: number }

function toSaved(result: Result): SavedResult {
  return {
    id: result.question.id,
    prompt: result.question.prompt,
    typed: result.typed,
    outcome: result.outcome,
    answer: result.answer?.label,
    timedOut: result.timedOut,
  }
}

/**
 * In development, `?finale` opens the arrival with a made-up game and `?mondo=0` to `?mondo=3` the
 * show of that world completed, to try them quickly.
 */
function firstView(): View {
  if (!import.meta.env.DEV) return { name: 'home' }
  const params = new URLSearchParams(location.search)
  const world = Number(params.get('mondo'))
  if (params.has('mondo') && world >= 0 && world <= 3) return { name: 'world', world }
  if (!params.has('finale')) return { name: 'home' }
  const results: Result[] = Array.from({ length: 7 }, (_, i) => ({
    question: { id: `prova-${i}`, prompt: `Domanda di prova ${i + 1}`, answers: [] },
    typed: '',
    outcome: i % 2 ? 't' : 'e',
  }))
  return { name: 'finale', results, target: DEFAULT_TARGET }
}

export function App() {
  const saved = useSavedState()
  const bank = useMemo(() => mergeBank(saved.custom), [saved.custom])
  const byId = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank])
  const [view, setView] = useState<View>(firstView)

  function toResult(result: SavedResult): Result {
    const question = byId.get(result.id) ?? { id: result.id, prompt: result.prompt, answers: [] }
    return {
      question,
      typed: result.typed,
      outcome: result.outcome,
      answer: question.answers.find((answer) => answer.label === result.answer),
      timedOut: result.timedOut,
    }
  }

  /** Never stuck: with repetition off and no new question left, the oldest ones come back anyway. */
  function nextQuestion(asked: Question[]): Question {
    const { seen, repeat } = getState()
    return pickNext(bank, seen, asked, repeat) ?? pickNext(bank, seen, asked, true) ?? bank[0]!
  }

  function open(game: SavedGame) {
    const { timerOn, timerSeconds } = getState()
    const results = game.results.map(toResult)
    const pending = game.pending ? byId.get(game.pending) : undefined
    const answered = new Set(game.results.map((result) => result.id))
    const question = pending && !answered.has(pending.id) ? pending : nextQuestion(results.map((result) => result.question))
    saveGame({ ...game, pending: question.id })
    setView({ name: 'game', id: Date.now(), target: game.target, timer: timerOn ? timerSeconds : 0, start: { results, question } })
  }

  function newGame() {
    open({ target: getState().target, startedAt: Date.now(), results: [] })
  }

  function play() {
    const { current } = getState()
    if (current) open(current)
    else newGame()
  }

  function save(target: Target, results: Result[], onScreen: Question | null) {
    saveGame({
      target,
      startedAt: getState().current?.startedAt ?? Date.now(),
      results: results.map(toSaved),
      pending: onScreen?.id,
    })
  }

  function finish(target: Target, results: Result[]) {
    recordGame({
      at: Date.now(),
      score: scoreOf(results),
      outcomes: results.map((result) => result.outcome),
      target,
      questions: results.length,
    })
    saveGame(null)
    setView({ name: 'finale', results, target })
  }

  switch (view.name) {
    case 'home':
      return <Home bank={bank} onPlay={play} onNewGame={newGame} onSettings={() => setView({ name: 'settings' })} />
    case 'settings':
      return <Settings bank={bank} onBack={() => setView({ name: 'home' })} />
    case 'game':
      return (
        <Game
          key={view.id}
          target={view.target}
          timer={view.timer}
          start={view.start}
          nextQuestion={nextQuestion}
          onSave={(results, onScreen) => save(view.target, results, onScreen)}
          onFinish={(results) => finish(view.target, results)}
          onQuit={() => setView({ name: 'home' })}
        />
      )
    case 'finale':
      return (
        <Finale
          target={view.target}
          questions={view.results.length}
          onDone={() => setView({ name: 'summary', results: view.results, target: view.target })}
        />
      )
    case 'world':
      return <WorldDone world={view.world} target={DEFAULT_TARGET} onDone={() => setView({ name: 'home' })} />
    case 'summary':
      return <Summary results={view.results} target={view.target} onAgain={newGame} onHome={() => setView({ name: 'home' })} />
  }
}
