import { useEffect, useMemo, useState } from 'react'
import { EndCredits } from './components/EndCredits'
import { Finale } from './components/Finale'
import { Game, scoreOf, type Result } from './components/Game'
import { GameOver } from './components/GameOver'
import { Home, Settings, Summary } from './components/Screens'
import { Trophies } from './components/Trophies'
import { StepDone } from './components/StepDone'
import { SurpriseSquare } from './components/Surprise'
import { mergeBank, pickNext } from './game/bank'
import type { Question } from './game/parse'
import { playTune, type TuneId } from './game/sound'
import { getState, markCleared, markReached, recordGame, saveGame, update, useSavedState, winTrophies, type SavedGame, type SavedResult } from './game/store'
import { rulesFor, WHEELS, type Met } from './game/surprise'
import { maxQuestions, OUTCOMES, TIER_INFO } from './game/tiers'
import { trophiesFor } from './game/trophies'
import { isWorldId, nextWorld, worldInfo, WORLDS, type WheelKind, type WorldId, type WorldInfo } from './game/worlds'

type View =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'trophies' }
  | {
      name: 'game'
      id: number
      world: WorldId
      hardcore: boolean
      timer: number
      start: { results: Result[]; question: Question; met: Met; retried?: string; swapped: Question[] }
    }
  /**
   * The end of a game, then the summary: the arrival, or the questions run out. `target` is the
   * points the arrival was at in the end, after the wheels; `unlocked` the world it opened.
   */
  | { name: 'finale'; world: WorldId; results: Result[]; target: number; hardcore: boolean; unlocked?: WorldId; trophies?: string[] }
  | { name: 'summary'; world: WorldId; results: Result[]; target: number; hardcore: boolean }
  /** The end of the whole game, after the arrival of the last world and its summary: the credits. */
  | { name: 'credits'; world: WorldId }
  /** Development only: one step show on its own. */
  | { name: 'step'; world: WorldId; step: number }
  /** Development only: a wheel on its own. */
  | { name: 'wheel'; wheel: WheelKind; forced: boolean }

function toSaved(result: Result): SavedResult {
  return {
    id: result.question.id,
    prompt: result.question.prompt,
    typed: result.typed,
    outcome: result.outcome,
    answer: result.answer?.label,
    timedOut: result.timedOut,
    retried: result.retried,
    double: result.double,
  }
}

/**
 * In development, to try the shows quickly: `?finale=decanter` (the arrival), `?finale=tigros-230`
 * (questions run out at about 230 points), `?step=parcheggio-4` (the show of a step),
 * `?ruota=malus-diamond` (a wheel; `?ruota=classic` can be skipped), `?titoli` (the end of the
 * game with the credits), `?sblocca` (all worlds open), `?hardcore` (hardcore on, for the red
 * theme) and `?vista=impostazioni` or `?vista=trofei`.
 */
function firstView(): View {
  if (!import.meta.env.DEV) return { name: 'home' }
  const params = new URLSearchParams(location.search)
  if (params.has('sblocca')) update((current) => ({ ...current, reached: WORLDS.map((world) => world.id) }))
  const [stepWorld, stepIndex] = (params.get('step') ?? '').split('-')
  if (isWorldId(stepWorld)) return { name: 'step', world: stepWorld, step: Math.max(1, Math.min(4, Number(stepIndex) || 1)) }
  if (params.has('hardcore')) update((current) => ({ ...current, hardcore: true, trophyTour: true }))
  if (params.get('vista') === 'impostazioni') return { name: 'settings' }
  if (params.get('vista') === 'trofei') return { name: 'trophies' }
  if (params.has('titoli')) return { name: 'credits', world: WORLDS[WORLDS.length - 1]!.id }
  const wheel = params.get('ruota')
  if (wheel && wheel in WHEELS) return { name: 'wheel', wheel: wheel as WheelKind, forced: wheel !== 'classic' }
  const [finaleWorld, wantedText] = (params.get('finale') ?? '').split('-')
  if (!isWorldId(finaleWorld)) return { name: 'home' }
  const target = worldInfo(finaleWorld).target
  const wanted = Number(wantedText)
  // As many questions as allowed, each worth the most that still fits under the wanted score.
  let left = wanted > 0 && wanted < target ? wanted : target
  const results: Result[] = Array.from({ length: maxQuestions(target) }, (_, i) => {
    const outcome = [...OUTCOMES].reverse().find((tier) => TIER_INFO[tier].points <= left) ?? 'miss'
    left -= TIER_INFO[outcome].points
    return { question: { id: `prova-${i}`, prompt: `Domanda di prova ${i + 1}`, answers: [] }, typed: 'prova', outcome }
  })
  return {
    name: 'finale',
    world: finaleWorld,
    results,
    target,
    hardcore: true,
    unlocked: nextWorld(finaleWorld)?.id,
    trophies: params.has('trofei')
      ? trophiesFor({ world: finaleWorld, hardcore: false, timer: 15, cleared: { easy: WORLDS.map((world) => world.id), hardcore: [] } })
      : undefined,
  }
}

export function App() {
  const saved = useSavedState()
  const bank = useMemo(() => mergeBank(saved.custom), [saved.custom])
  const byId = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank])
  const [view, setView] = useState<View>(firstView)

  // One tune per world: in the game the world played, elsewhere the world shown on the home screen.
  // The credits have a song of their own.
  const tune: TuneId = view.name === 'credits' ? 'credits' : 'world' in view ? view.world : saved.world
  useEffect(() => {
    playTune(tune)
  }, [tune])

  // Hardcore mode turns the whole game red.
  const theme = saved.hardcore ? 'hardcore' : 'light'
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    const color = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#f6ecd8')
  }, [theme])

  function toResult(result: SavedResult): Result {
    const question = byId.get(result.id) ?? { id: result.id, prompt: result.prompt, answers: [] }
    return {
      question,
      typed: result.typed,
      outcome: result.outcome,
      answer: question.answers.find((answer) => answer.label === result.answer),
      timedOut: result.timedOut,
      retried: result.retried,
      double: result.double,
    }
  }

  /** Never stuck: with repetition off and no new question left, the oldest ones come back anyway. */
  function nextQuestion(asked: Question[]): Question {
    const { seen, repeat } = getState()
    return pickNext(bank, seen, asked, repeat) ?? pickNext(bank, seen, asked, true) ?? bank[0]!
  }

  function open(game: SavedGame) {
    const { timerOn, timerSeconds } = getState()
    // The timer the game was started with; older games take the one in Impostazioni.
    const timer = typeof game.timer === 'number' ? game.timer : timerOn ? timerSeconds : 0
    const info = worldInfo(game.world)
    const results = game.results.map(toResult)
    const hardcore = game.hardcore === true
    const met = game.met ?? {}
    // A game saved when it was already over (all its questions played) goes straight to its ending.
    const { goal, limit } = rulesFor(info.target, met, hardcore)
    if (results.length >= limit || scoreOf(results) >= goal) {
      finish(game.world, results, goal, hardcore, timer)
      return
    }
    const pending = game.pending ? byId.get(game.pending) : undefined
    const answered = new Set(game.results.map((result) => result.id))
    const swapped = (game.swapped ?? []).map((id) => byId.get(id)).filter((question): question is Question => !!question)
    const question =
      pending && !answered.has(pending.id) ? pending : nextQuestion([...results.map((result) => result.question), ...swapped])
    saveGame(game.world, { ...game, pending: question.id, timer })
    // The Carta Rivincita used on the question on screen stays used when the game is picked up again.
    const retried = game.retried === question.id ? game.retried : undefined
    setView({
      name: 'game',
      id: Date.now(),
      world: game.world,
      hardcore,
      timer,
      start: { results, question, met, retried, swapped },
    })
  }

  function newGame(world: WorldId) {
    update((current) => ({ ...current, world }))
    const { hardcore, timerOn, timerSeconds } = getState()
    open({ world, hardcore, startedAt: Date.now(), results: [], timer: timerOn ? timerSeconds : 0 })
  }

  function play(world: WorldId) {
    const game = getState().playing[world]
    if (game) open(game)
    else newGame(world)
  }

  function save(
    world: WorldId,
    hardcore: boolean,
    timer: number,
    results: Result[],
    onScreen: Question | null,
    extra: { met?: Met; retried?: string; swapped?: string[] },
  ) {
    const current = getState().playing[world]
    saveGame(world, {
      world,
      hardcore,
      startedAt: current?.startedAt ?? Date.now(),
      results: results.map(toSaved),
      pending: onScreen?.id,
      met: extra.met ?? current?.met,
      retried: onScreen && extra.retried === onScreen.id ? extra.retried : undefined,
      swapped: extra.swapped ?? current?.swapped,
      timer,
    })
  }

  function finish(world: WorldId, results: Result[], goal: number, hardcore: boolean, timer: number) {
    const score = scoreOf(results)
    const arrived = score >= goal
    const next = nextWorld(world)
    // The first time the arrival is reached, the next world opens.
    const unlocked = arrived && next && !getState().reached.includes(world) ? next.id : undefined
    recordGame({
      at: Date.now(),
      score,
      outcomes: results.map((result) => result.outcome),
      target: goal,
      questions: results.length,
      world,
      arrived,
    })
    if (arrived) markReached(world)
    // The trophies this arrival wins, shown on the arrival screen.
    const trophies = arrived ? winTrophies(trophiesFor({ world, hardcore, timer, cleared: getState().cleared })) : []
    if (arrived) markCleared(world, hardcore)
    saveGame(world, null)
    setView({ name: 'finale', world, results, target: goal, hardcore, unlocked, trophies })
  }

  switch (view.name) {
    case 'home':
      return (
        <Home
          bank={bank}
          onPlay={play}
          onNewGame={newGame}
          onSettings={() => setView({ name: 'settings' })}
          onTrophies={() => {
            if (!getState().trophyTour) update((current) => ({ ...current, trophyTour: true }))
            setView({ name: 'trophies' })
          }}
        />
      )
    case 'trophies':
      return <Trophies onBack={() => setView({ name: 'home' })} />
    case 'settings':
      return <Settings bank={bank} onBack={() => setView({ name: 'home' })} />
    case 'game':
      return (
        <Game
          key={view.id}
          world={worldInfo(view.world)}
          hardcore={view.hardcore}
          timer={view.timer}
          start={view.start}
          nextQuestion={nextQuestion}
          onSave={(results, onScreen, extra) => save(view.world, view.hardcore, view.timer, results, onScreen, extra)}
          onFinish={(results, goal) => finish(view.world, results, goal, view.hardcore, view.timer)}
          onQuit={() => setView({ name: 'home' })}
        />
      )
    case 'finale': {
      const info: WorldInfo = worldInfo(view.world)
      const toSummary = () => setView({ name: 'summary', world: view.world, results: view.results, target: view.target, hardcore: view.hardcore })
      if (scoreOf(view.results) < view.target) {
        return <GameOver world={info} score={scoreOf(view.results)} target={view.target} questions={view.results.length} onDone={toSummary} />
      }
      return (
        <Finale
          world={info}
          target={view.target}
          questions={view.results.length}
          unlocked={view.unlocked ? worldInfo(view.unlocked) : undefined}
          trophies={view.trophies}
          onDone={toSummary}
        />
      )
    }
    case 'credits':
      return <EndCredits onDone={() => setView({ name: 'home' })} />
    case 'step':
      return <StepDone world={worldInfo(view.world)} step={view.step} goal={worldInfo(view.world).target} onDone={() => setView({ name: 'home' })} />
    case 'wheel':
      return (
        <SurpriseSquare
          spot={{ at: 0, wheel: view.wheel, forced: view.forced }}
          rulesWith={(prize) => rulesFor(500, { 0: prize })}
          onSkip={() => setView({ name: 'home' })}
          onPrize={() => {}}
          onDone={() => setView({ name: 'home' })}
        />
      )
    case 'summary': {
      // The arrival of the last world ends the whole game: after its summary the credits roll.
      const theEnd = !nextWorld(view.world) && scoreOf(view.results) >= view.target
      return (
        <Summary
          world={worldInfo(view.world)}
          results={view.results}
          target={view.target}
          hardcore={view.hardcore}
          onAgain={() => newGame(view.world)}
          onHome={() => setView({ name: 'home' })}
          onEnd={theEnd ? () => setView({ name: 'credits', world: view.world }) : undefined}
        />
      )
    }
  }
}
