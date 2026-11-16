import { describe, expect, it } from 'vitest'
import { builtIn, derived, family, LETTER_GROUPS, MIN_LETTER_ANSWERS, mergeBank, mergeCustom, pickNext } from './bank'
import { editDistance, matchAnswer, stem, tokenize } from './match'
import { compile, parseJson, parseText, parseUpload, type RawQuestion } from './parse'
import { maxQuestions, stepOf, stopsFor, SWAPS, TIERS } from './tiers'
import { isUnlocked, nextWorld, WORLDS } from './worlds'

const fruit: RawQuestion = {
  q: 'Un frutto',
  c: ['mela', 'banana'],
  n: ['anguria/cocomero', 'kiwi'],
  r: ['melograno/melagrana'],
  e: ['frutto della passione/maracuja'],
  t: ["fico d'India", 'Spider-Man'],
}
const answers = compile(fruit).answers

function label(input: string): string {
  const result = matchAnswer(input, answers)
  return result.kind === 'miss' ? 'miss' : `${result.kind}:${result.answer.label}`
}

describe('normalising', () => {
  it('drops case, accents, punctuation and articles', () => {
    expect(tokenize("  L'Árancia  ")).toEqual(['arancia'])
    expect(tokenize('Il Signore degli Anelli')).toEqual(['signore', 'degli', 'anelli'])
    expect(tokenize('La')).toEqual(['la'])
  })

  it('stems singular and plural to the same thing', () => {
    expect(stem('banane')).toBe(stem('banana'))
    expect(stem('oche')).toBe(stem('oca'))
    expect(stem('arance')).toBe(stem('arancia'))
    expect(stem('amici')).toBe(stem('amico'))
  })

  it('counts a swap as one typo', () => {
    expect(editDistance('banana', 'banaan')).toBe(1)
    expect(editDistance('kiwi', 'kiwi')).toBe(0)
  })
})

describe('matching an answer', () => {
  it('accepts the same answer written differently', () => {
    expect(label('MELA')).toBe('exact:mela')
    expect(label('le banane')).toBe('exact:banana')
    expect(label('cocomero')).toBe('exact:anguria')
    expect(label('spiderman')).toBe('exact:Spider-Man')
    expect(label('fico d india')).toBe("exact:fico d'India")
    expect(label('fichi d’India')).toBe("exact:fico d'India")
    expect(label('frutto passione')).toBe('exact:frutto della passione')
  })

  it('asks before accepting a near miss', () => {
    expect(label('bannana')).toBe('suggest:banana')
    expect(label('melogrno')).toBe('suggest:melograno')
    expect(label('maracuia')).toBe('suggest:frutto della passione')
  })

  it('accepts an answer without its brackets or with words more or less', () => {
    const famous = compile({
      q: 'Un personaggio famoso',
      c: ['Il commissario Montalbano', 'Ade (Hercules)'],
      n: ['Argo (cane di Ulisse)', 'Lago di Garda'],
      r: ['Pizza margherita'],
      e: ['torta'],
      t: ['Torre di Pisa', 'Torre Eiffel'],
    }).answers
    const said = (input: string) => {
      const result = matchAnswer(input, famous)
      return result.kind === 'miss' ? 'miss' : `${result.kind}:${result.answer.label}`
    }
    expect(said('Ade')).toBe('exact:Ade (Hercules)')
    expect(said('argo')).toBe('exact:Argo (cane di Ulisse)')
    expect(said('Montalbano')).toBe('exact:Il commissario Montalbano')
    expect(said('garda')).toBe('exact:Lago di Garda')
    expect(said('Pisa torre')).toBe('exact:Torre di Pisa')
    expect(said('torta della nonna')).toBe('suggest:torta')
    expect(said('margherita')).toBe('exact:Pizza margherita')
    expect(said('pizza')).toBe('suggest:Pizza margherita')
    expect(said('torre')).toBe('suggest:Torre di Pisa')
    expect(said('montalbamo')).toBe('suggest:Il commissario Montalbano')
  })

  it('misses what is not in the list', () => {
    expect(label('sedia')).toBe('miss')
    expect(label('   ')).toBe('miss')
    expect(label('me')).toBe('miss')
  })
})

describe('reading question files', () => {
  it('reads the text format and reports bad lines', () => {
    const { questions, problems } = parseText(
      ['# commento', 'Un colore :: rosso, blu :: verde :: viola :: indaco :: ocra', 'riga rotta :: a'].join('\n'),
    )
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({ q: 'Un colore', c: ['rosso', 'blu'], t: ['ocra'] })
    expect(problems).toHaveLength(1)
  })

  it('reads JSON with short or long names', () => {
    const long = parseJson({
      domande: [{ domanda: 'Un colore', risposte: { comune: ['rosso'], nonComune: ['verde'], top: ['ocra'] } }],
    })
    expect(long.questions[0]).toMatchObject({ q: 'Un colore', c: ['rosso'], n: ['verde'], r: [], t: ['ocra'] })
    const short = parseUpload('[{"q":"Un colore","c":["rosso"]},{"q":"","c":["x"]},{"q":"Vuota"}]')
    expect(short.questions).toHaveLength(1)
    expect(short.problems).toHaveLength(2)
    expect(parseUpload('{ non json').questions).toHaveLength(0)
  })

  it('keeps the commonest tier of a repeated answer', () => {
    const question = compile({ q: 'x', c: ['mela'], n: ['Mela', 'pera'], r: [], e: [], t: [] })
    expect(question.answers.map((answer) => `${answer.tier}:${answer.label}`)).toEqual(['c:mela', 'n:pera'])
  })
})

describe('choosing questions', () => {
  const bank = Array.from({ length: 8 }, (_, i) => compile({ ...fruit, q: `Domanda ${i}` }))

  it('prefers questions never played, and never repeats one in the same game', () => {
    const seen = Object.fromEntries(bank.slice(0, 3).map((question, i) => [question.id, i + 1]))
    const asked = [bank[3]!, bank[4]!]
    for (let run = 0; run < 30; run++) {
      const next = pickNext(bank, seen, asked)!
      expect(seen[next.id]).toBeUndefined()
      expect(asked.map((question) => question.id)).not.toContain(next.id)
    }
  })

  it('brings back the ones played longest ago when the new ones are over', () => {
    const seen = Object.fromEntries(bank.map((question, i) => [question.id, i + 1]))
    const next = pickNext(bank, seen, [bank[0]!])!
    expect(next.id).not.toBe(bank[0]!.id)
  })

  it('stops when repeating is off and no new question is left', () => {
    const seen = Object.fromEntries(bank.map((question, i) => [question.id, i + 1]))
    expect(pickNext(bank, seen, [], false)).toBeNull()
  })

  it('keeps look-alike questions apart', () => {
    expect(family('Una città del Giappone')).toBe(family("Una città dell'Austria"))
    expect(family('Un piatto della cucina cinese')).toBe(family('Un piatto tipico della cucina romana'))
    expect(family('Un animale che inizia con la C')).toBe(family('Una marca che inizia con la B'))
    expect(family('Un frutto')).not.toBe(family('Un fiore'))
    const prompts = ['Una città del Giappone', 'Una città della Spagna', 'Una città del Brasile', 'Un frutto', 'Un fiore', 'Un colore', 'Un mestiere']
    const mixed = prompts.map((q) => compile({ ...fruit, q }))
    for (let run = 0; run < 30; run++) {
      const next = pickNext(mixed, {}, [mixed[0]!])!
      expect(family(next.prompt)).not.toBe(family(mixed[0]!.prompt))
    }
  })

  it('replaces an uploaded question with the same text', () => {
    const merged = mergeCustom([fruit], [{ ...fruit, c: ['pera'] }, { ...fruit, q: 'Altro' }])
    expect(merged).toMatchObject({ added: 1, replaced: 1 })
    expect(merged.custom).toHaveLength(2)
  })
})

describe('built-in questions', () => {
  const bank = mergeBank([])

  it('parse without problems and have unique texts', () => {
    expect(builtIn.problems).toEqual([])
    expect(bank.length).toBe(builtIn.questions.length + derived.length)
  })

  it('have answers in every tier, none listed twice', () => {
    const issues: string[] = []
    for (const raw of [...builtIn.questions, ...derived]) {
      const question = compile(raw)
      for (const tier of TIERS) if (raw[tier].length === 0) issues.push(`${raw.q}: nessuna risposta ${tier}`)
      const written = TIERS.reduce((sum, tier) => sum + raw[tier].length, 0)
      if (written !== question.answers.length) issues.push(`${raw.q}: una risposta è ripetuta`)
    }
    expect(issues).toEqual([])
  })

  it('name only questions that exist as letter sources', () => {
    const prompts = new Set(builtIn.questions.map((raw) => raw.q))
    const missing = LETTER_GROUPS.flatMap((group) => group.sources.filter((source) => !prompts.has(source)))
    expect(missing).toEqual([])
  })

  it('build letter questions that keep the letter and the order of rarity', () => {
    const subjects = derived.map((raw) => raw.q.replace(/ che inizia con la \S+$/, ''))
    expect(new Set(subjects).size).toBe(subjects.length)
    expect(derived.length).toBeLessThanOrEqual(LETTER_GROUPS.length)
    for (const raw of derived) {
      const letter = raw.q.slice(-1).toLowerCase()
      const answers = TIERS.flatMap((tier) => raw[tier])
      expect(answers.length).toBeGreaterThanOrEqual(MIN_LETTER_ANSWERS)
      for (const answer of answers) for (const form of answer.split('/')) expect(tokenize(form).join(' ')[0]).toBe(letter)
    }
  })

  it('have as many comune as non comune answers, and as many raro as esclusivo', () => {
    for (const raw of [...builtIn.questions, ...derived]) {
      expect([raw.q, raw.n.length]).toEqual([raw.q, raw.c.length])
      expect([raw.q, raw.e.length]).toEqual([raw.q, raw.r.length])
    }
  })

  it('reach the target size', () => {
    expect(bank.length).toBeGreaterThanOrEqual(1500)
  })
})

describe('suspense', () => {
  it('lasts longer the rarer the answer', async () => {
    const { revealMs } = await import('../components/RarityMeter')
    const times = (['miss', 'c', 'n', 'r', 'e', 't'] as const).map(revealMs)
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]!)
    expect(times[0]).toBeGreaterThan(5000)
    expect(times[5]).toBeGreaterThan(9000)
  })

  it('goes up as often as it falls back, a miss included', async () => {
    const { pushesOn } = await import('../components/RarityMeter')
    for (const outcome of ['miss', 'c', 'n', 'r', 'e'] as const) {
      expect(pushesOn(outcome, () => 0.2)).toBe(true)
      expect(pushesOn(outcome, () => 0.7)).toBe(false)
    }
    expect(pushesOn('t', () => 0.99)).toBe(true)
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const ups = Array.from({ length: 2000 }, () => pushesOn('miss', random)).filter(Boolean).length
    expect(ups / 2000).toBeGreaterThan(0.45)
    expect(ups / 2000).toBeLessThan(0.55)
  })
})

describe('sound', () => {
  it('tunes notes and slows the wheel clicks down to a stop', async () => {
    const { midi, wheelTickTimes } = await import('./sound')
    expect(midi(69)).toBe(440)
    expect(Math.round(midi(60))).toBe(262)
    const ticks = wheelTickTimes(2500, 5.2)
    expect(ticks.length).toBe(Math.floor(2500 / 72))
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!)
    // Fast at first, slow at the end.
    expect(ticks[1]! - ticks[0]!).toBeLessThan(ticks[ticks.length - 1]! - ticks[ticks.length - 2]!)
    expect(ticks[ticks.length - 1]!).toBeLessThanOrEqual(5.2)
  })
})

describe('gaussian tiers', () => {
  it('gives comune and non comune the same number of answers, and raro and esclusivo too', async () => {
    const { gaussianSizes } = await import('./bank')
    expect(gaussianSizes(40)).toEqual([10, 10, 8, 8, 4])
    expect(gaussianSizes(100)).toEqual([22, 22, 24, 24, 8])
    expect(gaussianSizes(8)).toEqual([2, 2, 1, 1, 2])
    for (let n = 5; n <= 400; n++) {
      const [c, nc, r, e, t] = gaussianSizes(n) as [number, number, number, number, number]
      expect(c + nc + r + e + t).toBe(n)
      expect(Math.min(c, nc, r, e, t)).toBeGreaterThanOrEqual(1)
      expect(nc).toBe(c)
      expect(e).toBe(r)
      if (n >= 20) expect(t).toBeLessThanOrEqual(r)
    }
  })

  it('keeps the order of the answers', async () => {
    const { gaussianTiers } = await import('./bank')
    const answers = Array.from({ length: 20 }, (_, i) => `a${i}`)
    const cut = gaussianTiers({ q: 'x', c: answers.slice(0, 2), n: answers.slice(2, 5), r: answers.slice(5, 9), e: answers.slice(9, 14), t: answers.slice(14) })
    expect([...cut.c, ...cut.n, ...cut.r, ...cut.e, ...cut.t]).toEqual(answers)
    expect(cut.c).toEqual(answers.slice(0, 5))
    expect(cut.n).toEqual(answers.slice(5, 10))
    expect(cut.r).toEqual(answers.slice(10, 14))
    expect(cut.e).toEqual(answers.slice(14, 18))
    expect(cut.t).toEqual(['a18', 'a19'])
  })
})

describe('timer', () => {
  it('turns from green to yellow, orange and red as time runs out', async () => {
    const { timerLevel } = await import('./timer')
    expect([60, 31, 30, 19, 18, 10, 9, 0].map((s) => timerLevel(s * 1000, 60_000))).toEqual([
      'green',
      'green',
      'yellow',
      'yellow',
      'orange',
      'orange',
      'red',
      'red',
    ])
  })

  it('shows minutes and seconds, rounded up', async () => {
    const { formatClock, timerLabel, TIMER_CHOICES } = await import('./timer')
    expect(formatClock(300_000)).toBe('5:00')
    expect(formatClock(59_001)).toBe('1:00')
    expect(formatClock(4_200)).toBe('0:05')
    expect(formatClock(0)).toBe('0:00')
    expect(TIMER_CHOICES.map(timerLabel)).toEqual(['30 s', '1 min', '2 min', '5 min'])
  })
})

describe('the five worlds', () => {
  it('go from the Parcheggio to the Decanter, longer and longer, five steps each', () => {
    expect(WORLDS.map((world) => world.id)).toEqual(['parcheggio', 'tigros', 'casa', 'varigotti', 'decanter'])
    expect(WORLDS.map((world) => world.target)).toEqual([500, 750, 1000, 1250, 1500])
    for (const world of WORLDS) {
      expect(world.steps).toHaveLength(5)
      expect(world.arrival.title.length).toBeGreaterThan(0)
    }
    expect(WORLDS[0]!.steps.map((step) => step.name)).toEqual(['Sobri', "Un po' fatti", 'Decisamente fatti', 'Fattissimi', 'Jo sta male'])
    expect(WORLDS[4]!.steps.map((step) => step.name)).toEqual(['Sobri', 'Sbrillo', 'Birillo', 'Ubriachi', '💀'])
    expect(WORLDS.find((world) => world.id === 'varigotti')!.arrival.title).toContain('casa di Ale a Varigotti')
  })

  it('change step every fifth of the trail', () => {
    expect(stopsFor(500)).toEqual([100, 200, 300, 400])
    expect(stopsFor(1500)).toEqual([300, 600, 900, 1200])
    expect([0, 99, 100, 299, 300, 1199, 1200, 1500].map((score) => stepOf(score, 1500))).toEqual([0, 0, 0, 0, 1, 3, 4, 4])
  })

  it('have one question every 25 points, a quarter fewer without hardcore, and 5 swaps', () => {
    expect(WORLDS.map((world) => maxQuestions(world.target))).toEqual([20, 30, 40, 50, 60])
    expect(WORLDS.map((world) => maxQuestions(world.target, false))).toEqual([15, 23, 30, 38, 45])
    expect(SWAPS).toBe(5)
  })

  it('open one after the other', () => {
    expect(WORLDS.map((world) => isUnlocked(world.id, []))).toEqual([true, false, false, false, false])
    expect(isUnlocked('tigros', ['parcheggio'])).toBe(true)
    expect(isUnlocked('casa', ['parcheggio'])).toBe(false)
    expect(nextWorld('parcheggio')?.id).toBe('tigros')
    expect(nextWorld('decanter')).toBeUndefined()
  })

  it('put their "?" squares where asked, the later ones not to be skipped', () => {
    const spots = Object.fromEntries(WORLDS.map((world) => [world.id, world.spots.map((spot) => `${spot.at}:${spot.wheel}:${spot.forced}`)]))
    expect(spots).toEqual({
      parcheggio: ['250:classic:false'],
      tigros: ['375:classic:false'],
      casa: ['250:classic:false', '750:malus:true'],
      varigotti: ['250:classic:false', '750:malus:true'],
      decanter: ['500:malus-gold:true', '1000:malus-diamond:true'],
    })
  })

  it('spin wheels that move the arrival, change the questions or give a card', async () => {
    const { PRIZE_INFO, rulesFor, spinPrize, WHEELS } = await import('./surprise')
    const kinds = (wheel: keyof typeof WHEELS) => WHEELS[wheel].map((prize) => PRIZE_INFO[prize].kind).sort()
    expect(kinds('classic')).toEqual(['bonus', 'bonus', 'gold', 'malus', 'malus'])
    expect(kinds('malus')).toEqual(['malus', 'malus', 'malus', 'malus'])
    expect(kinds('malus-gold')).toEqual(['gold', 'malus', 'malus', 'malus', 'malus'])
    expect(kinds('malus-diamond')).toEqual(['diamond', 'malus', 'malus', 'malus', 'malus'])
    expect(rulesFor(500)).toEqual({ goal: 500, limit: 20, card: false, diamond: false })
    expect(rulesFor(500, { 0: null })).toEqual({ goal: 500, limit: 20, card: false, diamond: false })
    expect(rulesFor(1000, { 0: 'goal-down', 1: 'goal-up-200' }).goal).toBe(1100)
    expect(rulesFor(1500, { 0: 'questions-down-5', 1: 'questions-down' }, false).limit).toBe(37)
    expect(rulesFor(1500, { 0: 'card', 1: 'diamond' })).toMatchObject({ card: true, diamond: true })
    // Each slice is as likely as the others.
    const counts = new Map<string, number>()
    for (let i = 0; i < 1000; i++) {
      const prize = spinPrize('malus', () => i / 1000)
      counts.set(prize, (counts.get(prize) ?? 0) + 1)
    }
    expect([...counts.values()]).toEqual([250, 250, 250, 250])
  })

  it('count double points with the Carta Diamante', async () => {
    const { pointsOf, scoreOf } = await import('../components/Game')
    expect(pointsOf({ outcome: 'r' })).toBe(50)
    expect(pointsOf({ outcome: 'r', double: true })).toBe(100)
    expect(scoreOf([{ outcome: 't' }, { outcome: 'c', double: true }, { outcome: 'miss', double: true }])).toBe(120)
  })

  it('have a tune each', async () => {
    const { TUNES } = await import('./sound')
    for (const world of WORLDS) {
      const tune = TUNES[world.id]
      const beats = tune.melody.reduce((sum, [, length]) => sum + length, 0)
      expect(beats).toBe(tune.roots.length * tune.beatsPerBar)
      const song = TUNES.credits
      expect(song.melody.reduce((sum, [, length]) => sum + length, 0)).toBe(song.roots.length * song.beatsPerBar)
    }
  })
})
