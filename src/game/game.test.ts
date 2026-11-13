import { describe, expect, it } from 'vitest'
import { builtIn, derived, LETTER_GROUPS, MIN_LETTER_ANSWERS, mergeBank, mergeCustom, pickQuestions } from './bank'
import { editDistance, matchAnswer, stem, tokenize } from './match'
import { compile, parseJson, parseText, parseUpload, type RawQuestion } from './parse'
import { MAX_SCORE, stopsReached, TIERS } from './tiers'

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
  })

  it('asks before accepting a near miss', () => {
    expect(label('bannana')).toBe('suggest:banana')
    expect(label('melogrno')).toBe('suggest:melograno')
    expect(label('maracuia')).toBe('suggest:frutto della passione')
    expect(label('frutto passione')).toBe('suggest:frutto della passione')
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

  it('prefers questions never played', () => {
    const seen = Object.fromEntries(bank.slice(0, 3).map((question, i) => [question.id, i + 1]))
    const picked = pickQuestions(bank, seen, 5)
    expect(picked).toHaveLength(5)
    expect(picked.every((question) => seen[question.id] === undefined)).toBe(true)
  })

  it('falls back to the ones played longest ago', () => {
    const seen = Object.fromEntries(bank.slice(0, 6).map((question, i) => [question.id, i + 1]))
    const picked = pickQuestions(bank, seen, 5).map((question) => question.id)
    expect(new Set(picked).size).toBe(5)
    expect(picked).toContain(bank[6]!.id)
    expect(picked).toContain(bank[7]!.id)
    expect(picked).not.toContain(bank[5]!.id)
  })

  it('never brings a played question back when repeating is off', () => {
    const seen = Object.fromEntries(bank.slice(0, 6).map((question, i) => [question.id, i + 1]))
    const picked = pickQuestions(bank, seen, 5, false).map((question) => question.id)
    expect(picked.sort()).toEqual([bank[6]!.id, bank[7]!.id].sort())
  })

  it('replaces an uploaded question with the same text', () => {
    const merged = mergeCustom([fruit], [{ ...fruit, c: ['pera'] }, { ...fruit, q: 'Altro' }])
    expect(merged).toMatchObject({ added: 1, replaced: 1 })
    expect(merged.custom).toHaveLength(2)
  })
})

describe('score', () => {
  it('has four stops before the house', () => {
    expect(MAX_SCORE).toBe(500)
    expect([0, 99, 100, 250, 499, 500].map(stopsReached)).toEqual([0, 0, 1, 2, 4, 5])
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
    const fruit = derived.find((raw) => raw.q === 'Una cosa da mangiare che inizia con la M')!
    expect(fruit.c[0]).toBe('mela')
    for (const raw of derived) {
      const letter = raw.q.slice(-1).toLowerCase()
      const answers = TIERS.flatMap((tier) => raw[tier])
      expect(answers.length).toBeGreaterThanOrEqual(MIN_LETTER_ANSWERS)
      for (const answer of answers) for (const form of answer.split('/')) expect(tokenize(form).join(' ')[0]).toBe(letter)
    }
  })

  it('reach the target size', () => {
    expect(bank.length).toBeGreaterThanOrEqual(700)
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
})
