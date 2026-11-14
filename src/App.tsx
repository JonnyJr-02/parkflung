import { useMemo, useState } from 'react'
import { Finale } from './components/Finale'
import { Game, scoreOf, type Result } from './components/Game'
import { GameOver } from './components/GameOver'
import { Home, Settings, Summary } from './components/Screens'
import { SurpriseSquare } from './components/Surprise'
import { WorldDone } from './components/WorldDone'
import { mergeBank, pickNext } from './game/bank'
import type { Question } from './game/parse'
import { getState, recordGame, saveGame, useSavedState, type SavedGame, type SavedResult } from './game/store'
import { rulesFor, type Surprise } from './game/surprise'
import { DEFAULT_TARGET, maxQuestions, OUTCOMES, TIER_INFO, type Target } from './game/tiers'

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | {
      name: 'game'
      id: number
      target: Target
      timer: number
      start: { results: Result[]; question: Question; surprise?: Surprise; retried?: string }
    }
  /** The end of a game, then the summary: the arrival at the house of Ale, or the questions run out. */
  /** `target` is the points the house was at in the end, after the wheel of fortune. */
  | { name: 'finale'; results: Result[]; target: number }
  | { name: 'summary'; results: Result[]; target: number }
  /** Development only: one world-completed show on its own. */
  | { name: 'world'; world: number }
  /** Development only: the "?" square and its wheel on their own. */
  | { name: 'surprise' }

function toSaved(result: Result): SavedResult {
  return {
    id: result.question.id,
    prompt: result.question.prompt,
    typed: result.typed,
    outcome: result.outcome,
    answer: result.answer?.label,
    timedOut: result.timedOut,
    retried: result.retried,
  }
}

/**
 * In development, `?finale` opens the arrival with a made-up game, `?finale=230` the end of a game
 * that ran out of questions at about that score, and `?mondo=0` to `?mondo=3` the show of that
 * world completed, to try them quickly.
 */
function firstView(): View {
  if (!import.meta.env.DEV) return { name: 'home' }
  const params = new URLSearchParams(location.search)
  const world = Number(params.get('mondo'))
  if (params.has('mondo') && world >= 0 && world <= 3) return { name: 'world', world }
  if (params.has('imprevisto')) return { name: 'surprise' }
  if (!params.has('finale')) return { name: 'home' }
  const wanted = Number(params.get('finale'))
  if (wanted > 0 && wanted < DEFAULT_TARGET) {
    // As many questions as allowed, each worth the most that still fits under the wanted score.
    let left = wanted
    const results: Result[] = Array.from({ length: maxQuestions(DEFAULT_TARGET) }, (_, i) => {
      const outcome = [...OUTCOMES].reverse().find((tier) => TIER_INFO[tier].points <= left) ?? 'miss'
      left -= TIER_INFO[outcome].points
      return { question: { id: `prova-${i}`, prompt: `Domanda di prova ${i + 1}`, answers: [] }, typed: 'prova', outcome }
    })
    return { name: 'finale', results, target: DEFAULT_TARGET }
  }
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
      retried: result.retried,
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
    // A game saved when it was already over (all its questions played) goes straight to its ending.
    const { goal, limit } = rulesFor(game.target, game.surprise)
    if (results.length >= limit || scoreOf(results) >= goal) {
      finish(game.target, results, goal)
      return
    }
    const pending = game.pending ? byId.get(game.pending) : undefined
    const answered = new Set(game.results.map((result) => result.id))
    const question = pending && !answered.has(pending.id) ? pending : nextQuestion(results.map((result) => result.question))
    saveGame({ ...game, pending: question.id })
    // The Carta Rivincita used on the question on screen stays used when the game is picked up again.
    const retried = game.retried === question.id ? game.retried : undefined
    setView({
      name: 'game',
      id: Date.now(),
      target: game.target,
      timer: timerOn ? timerSeconds : 0,
      start: { results, question, surprise: game.surprise, retried },
    })
  }

  function newGame() {
    open({ target: getState().target, startedAt: Date.now(), results: [] })
  }

  function play() {
    const { current } = getState()
    if (current) open(current)
    else newGame()
  }

  function save(target: Target, results: Result[], onScreen: Question | null, extra: { surprise?: Surprise; retried?: string }) {
    saveGame({
      target,
      startedAt: getState().current?.startedAt ?? Date.now(),
      results: results.map(toSaved),
      pending: onScreen?.id,
      surprise: extra.surprise,
      retried: onScreen && extra.retried === onScreen.id ? extra.retried : undefined,
    })
  }

  function finish(target: Target, results: Result[], goal: number) {
    recordGame({
      at: Date.now(),
      score: scoreOf(results),
      outcomes: results.map((result) => result.outcome),
      target,
      questions: results.length,
    })
    saveGame(null)
    setView({ name: 'finale', results, target: goal })
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
          onSave={(results, onScreen, extra) => save(view.target, results, onScreen, extra)}
          onFinish={(results, goal) => finish(view.target, results, goal)}
          onQuit={() => setView({ name: 'home' })}
        />
      )
    case 'finale':
      if (scoreOf(view.results) < view.target) {
        return (
          <GameOver
            score={scoreOf(view.results)}
            target={view.target}
            questions={view.results.length}
            onDone={() => setView({ name: 'summary', results: view.results, target: view.target })}
          />
        )
      }
      return (
        <Finale
          target={view.target}
          questions={view.results.length}
          onDone={() => setView({ name: 'summary', results: view.results, target: view.target })}
        />
      )
    case 'world':
      return <WorldDone world={view.world} target={DEFAULT_TARGET} onDone={() => setView({ name: 'home' })} />
    case 'surprise':
      return (
        <SurpriseSquare
          target={DEFAULT_TARGET}
          onSkip={() => setView({ name: 'home' })}
          onPrize={() => {}}
          onDone={() => setView({ name: 'home' })}
        />
      )
    case 'summary':
      return <Summary results={view.results} target={view.target} onAgain={newGame} onHome={() => setView({ name: 'home' })} />
  }
}
