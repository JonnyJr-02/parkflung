import { makeKey, tokenize } from './match'
import { compile, parseText, questionId, type Question, type RawQuestion } from './parse'
import { TIERS, type Tier } from './tiers'

const packs = import.meta.glob<string>('../data/*.txt', { query: '?raw', import: 'default', eager: true })

/**
 * Share of a question's answers in each tier, commonest first: the right half of a normal curve
 * cut into bins half a σ wide, so "comune" is the biggest tier and each rarer one is smaller.
 */
export const GAUSSIAN_SHARE = [0.383, 0.3, 0.184, 0.088, 0.045] as const

/** How many answers go in each tier for a question with `n` answers: at least one each, largest remainders first. */
export function gaussianSizes(n: number): number[] {
  const exact = GAUSSIAN_SHARE.map((share) => share * n)
  const sizes = exact.map((x) => Math.max(1, Math.floor(x)))
  let total = sizes.reduce((sum, size) => sum + size, 0)
  // A tier already raised to one answer gets nothing more from the remainders.
  const remainder = exact.map((x) => (x < 1 ? -1 : x - Math.floor(x)))
  const byRemainder = [0, 1, 2, 3, 4].sort((a, b) => remainder[b]! - remainder[a]!)
  for (let k = 0; total < n; k++, total++) sizes[byRemainder[k % 5]!]! += 1
  while (total > n) {
    sizes[sizes.indexOf(Math.max(...sizes))]! -= 1
    total--
  }
  return sizes.sort((a, b) => b - a)
}

/**
 * Re-cuts a question's tiers along the half bell curve. The answers keep their order, from the one
 * most people would say to the rarest, so the rarity of each answer decides its tier.
 */
export function gaussianTiers(raw: RawQuestion): RawQuestion {
  const ranked = TIERS.flatMap((tier) => raw[tier])
  if (ranked.length < TIERS.length) return raw
  const out: RawQuestion = { q: raw.q, c: [], n: [], r: [], e: [], t: [] }
  let start = 0
  gaussianSizes(ranked.length).forEach((size, index) => {
    out[TIERS[index]!] = ranked.slice(start, start + size)
    start += size
  })
  return out
}

/**
 * The questions written in src/data, parsed once. A prompt written again in a later file (the
 * extra-*.txt packs) adds its answers to the same question, tier by tier; then every question is
 * cut into tiers along the normal curve.
 */
export const builtIn: { questions: RawQuestion[]; problems: string[] } = (() => {
  const byId = new Map<string, RawQuestion>()
  const problems: string[] = []
  for (const [file, text] of Object.entries(packs).sort(([a], [b]) => a.localeCompare(b))) {
    const parsed = parseText(text)
    for (const raw of parsed.questions) {
      const id = questionId(raw.q)
      const known = byId.get(id)
      if (known) TIERS.forEach((tier) => known[tier].push(...raw[tier]))
      else byId.set(id, { q: raw.q, c: [...raw.c], n: [...raw.n], r: [...raw.r], e: [...raw.e], t: [...raw.t] })
    }
    problems.push(...parsed.problems.map((problem) => `${file}: ${problem}`))
  }
  return { questions: [...byId.values()].map(gaussianTiers), problems }
})()

/**
 * "Starts with the letter…" questions built from the written ones: each group pools the answers of
 * some questions, keeps those starting with one letter and ranks them again into the five tiers,
 * so the commonest answers of the pool stay the commonest ones for that letter.
 */
export const LETTER_GROUPS: ReadonlyArray<{ subject: string; sources: string[] }> = [
  {
    subject: 'Un animale',
    sources: [
      'Un animale della fattoria',
      'Un animale africano',
      'Un animale del bosco',
      'Un animale che vive in mare',
      'Un uccello',
      'Un insetto o un piccolo animaletto',
      'Un rettile o un anfibio',
      'Un felino',
      'Un primate',
      'Un animale domestico',
      'Un animale australiano',
      'Un animale che vive al Polo Nord o al Polo Sud',
      'Un animale del Sud America',
      'Un animale asiatico',
      'Un animale notturno',
      'Un animale che va in letargo',
      'Un animale con le strisce o con le macchie',
      'Un animale velocissimo o lentissimo',
      'Un animale selvatico che vive in Italia',
      'Un animale velenoso',
      'Un animale con le corna',
      'Un uccello rapace',
      "Un pesce d'acqua dolce",
    ],
  },
  {
    subject: 'Una cosa da mangiare',
    sources: [
      'Un frutto',
      'Una verdura o un ortaggio',
      'Un formato di pasta',
      'Un formaggio italiano',
      'Un dolce tipico italiano',
      'Un salume',
      'Un pesce che si mangia',
      'Un tipo di pane o un prodotto da forno',
      'Un primo piatto della cucina italiana',
      'Un secondo piatto della cucina italiana',
      'Un antipasto',
      'Un cibo da street food italiano',
    ],
  },
  { subject: 'Un frutto o una verdura', sources: ['Un frutto', 'Una verdura o un ortaggio', 'Un tipo di frutta secca'] },
  {
    subject: 'Uno Stato del mondo',
    sources: [
      "Uno Stato dell'Unione Europea",
      "Uno Stato dell'Africa",
      "Uno Stato dell'Asia",
      'Uno Stato del Sud America',
      "Uno Stato dell'Oceania",
      "Un Paese dell'America centrale o dei Caraibi",
      "Un Paese dell'ex Unione Sovietica",
      'Uno Stato europeo che non fa parte dell\'Unione Europea',
    ],
  },
  {
    subject: 'Una città del mondo',
    sources: [
      'Una capitale europea',
      'Una capitale asiatica',
      'Una capitale africana',
      'Una capitale delle Americhe',
      'Una città degli Stati Uniti',
      'Una città della Francia',
      'Una città della Spagna',
      'Una città della Germania',
      'Una città del Regno Unito',
      'Una città del Giappone',
      'Una città italiana',
    ],
  },
  { subject: 'Una città italiana', sources: ['Una città italiana', 'Un capoluogo di regione italiano'] },
  {
    subject: 'Un oggetto di casa',
    sources: [
      'Un oggetto che trovi in cucina',
      'Una cosa che trovi in bagno',
      'Un mobile o un arredo di casa',
      'Un elettrodomestico',
      'Un oggetto che trovi in camera da letto',
    ],
  },
  { subject: 'Un capo di abbigliamento o un accessorio', sources: ['Un capo di abbigliamento', 'Un tipo di calzatura', 'Un tipo di cappello o copricapo', 'Un accessorio di moda'] },
  { subject: 'Un mestiere', sources: ['Un mestiere'] },
  { subject: 'Un colore', sources: ['Un colore'] },
  {
    subject: 'Uno sport',
    sources: ['Uno sport olimpico', 'Un gioco o uno sport con la palla', 'Uno sport di squadra', 'Uno sport invernale', "Un'arte marziale o uno sport da combattimento"],
  },
  {
    subject: 'Una marca',
    sources: [
      'Una marca di automobili',
      'Un marchio di moda italiano',
      'Una marca di moto o scooter',
      'Una marca di telefoni o di elettronica',
      'Una marca di birra',
      'Una marca di abbigliamento sportivo',
      'Una marca di biscotti, merendine o snack',
      'Una catena di negozi o di fast food',
      'Una marca di pasta',
      'Una marca di caffè',
      'Una marca di giocattoli',
      'Una marca di elettrodomestici',
      'Una marca di orologi',
      'Una marca di profumi o di cosmetici',
      'Una compagnia aerea',
    ],
  },
  { subject: 'Un fiore o una pianta', sources: ['Un fiore', 'Un albero', 'Una pianta da appartamento'] },
  { subject: 'Una parte del corpo umano', sources: ['Una parte del corpo umano', 'Un organo interno del corpo umano', 'Un osso del corpo umano'] },
  {
    subject: 'Un personaggio di fantasia',
    sources: [
      'Un personaggio Disney classico',
      'Un personaggio di Harry Potter',
      "Un personaggio de Il Signore degli Anelli o de Lo Hobbit",
      'Un personaggio dei Simpson',
      'Un personaggio di Super Mario',
      'Un personaggio di Star Wars',
      'Un personaggio di Dragon Ball',
      'Un supereroe',
      'Un cartone animato o un anime',
      'Un personaggio dei fumetti italiani',
      'Un personaggio di Friends',
      'Un personaggio della Casa di carta',
      'Un personaggio di Stranger Things',
      'Un personaggio de Il Trono di Spade',
      'Un personaggio dei Griffin',
      'Un personaggio di Pinocchio',
      'Un personaggio di Shrek',
      'Un personaggio di Toy Story',
      'Un personaggio dei Looney Tunes',
      'Un personaggio dei videogiochi',
    ],
  },
  { subject: 'Un nome di persona', sources: ['Un nome maschile', 'Un nome femminile'] },
  { subject: 'Uno strumento musicale', sources: ['Uno strumento musicale', 'Uno strumento a fiato', 'Uno strumento a percussione', 'Uno strumento a corda'] },
  {
    subject: 'Un luogo famoso di una città',
    sources: [
      'Un monumento o un luogo famoso di Roma',
      'Un luogo famoso di Milano',
      'Un luogo famoso di Firenze',
      'Un luogo famoso di Venezia',
      'Un luogo famoso di Napoli',
      'Un monumento o un luogo famoso di Torino',
      'Un luogo famoso di Parigi',
      'Un luogo famoso di Londra',
      'Un luogo famoso di New York',
    ],
  },
  { subject: 'Un mezzo di trasporto o un\'imbarcazione', sources: ['Un mezzo di trasporto', 'Un tipo di imbarcazione'] },
  {
    // The letter is the one the player types: "Messi" counts for M, "Lionel Messi" for L.
    subject: 'Un personaggio famoso (nome o cognome)',
    sources: [
      'Uno scienziato o un inventore famoso',
      'Un pittore famoso',
      'Un compositore di musica classica',
      'Uno scrittore o un poeta italiano',
      'Un regista famoso',
      'Un attore italiano',
      "Un'attrice italiana",
      'Un attore di Hollywood',
      "Un'attrice di Hollywood",
      'Un cantante o un gruppo italiano',
      'Un cantante o un gruppo pop straniero',
      'Un calciatore italiano',
      'Un calciatore straniero famoso',
      'Un tennista famoso',
      'Un filosofo',
      'Un personaggio storico italiano',
    ],
  },
  {
    subject: 'Un film, una serie TV o un libro',
    sources: [
      'Un film italiano famoso',
      'Un film horror',
      'Un film di fantascienza',
      'Un film vincitore dell\'Oscar al miglior film',
      'Una serie TV',
      'Un romanzo famoso',
      'Un libro per bambini o ragazzi',
      'Un film d\'animazione Disney o Pixar',
    ],
  },
  {
    subject: 'Una cosa da bere',
    sources: [
      'Una bevanda analcolica',
      'Un cocktail',
      'Un vino italiano',
      'Un liquore o un superalcolico',
      'Un tipo di caffè',
      'Un tipo di tè o di tisana',
      'Una marca di birra',
    ],
  },
]

/** A letter question needs at least this many answers to be fun. */
export const MIN_LETTER_ANSWERS = 12

function initial(form: string): string {
  return tokenize(form).join(' ').charAt(0)
}

export function deriveLetterQuestions(written: readonly RawQuestion[]): RawQuestion[] {
  const byPrompt = new Map(written.map((raw) => [raw.q, raw]))
  const out: RawQuestion[] = []
  for (const group of LETTER_GROUPS) {
    // Every answer of the pool once, ranked by its tier in its own question, then by its place there.
    const pool: { forms: string[]; tier: Tier; order: number }[] = []
    const taken = new Set<string>()
    for (const source of group.sources) {
      const raw = byPrompt.get(source)
      if (!raw) continue
      TIERS.forEach((tier) =>
        raw[tier].forEach((entry, order) => {
          const forms = entry
            .split('/')
            .map((form) => form.trim())
            .filter((form) => form && !taken.has(makeKey(form).squashed))
          if (forms.length === 0) return
          forms.forEach((form) => taken.add(makeKey(form).squashed))
          pool.push({ forms, tier, order })
        }),
      )
    }
    pool.sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.order - b.order)

    // Only the richest letter of each subject: many "… che inizia con la X" would feel all the same.
    let best: { letter: string; entries: string[] } | null = null
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      const entries = pool
        .map((answer) => answer.forms.filter((form) => initial(form) === letter))
        .filter((forms) => forms.length > 0)
        .map((forms) => forms.join('/'))
      if (entries.length >= MIN_LETTER_ANSWERS && entries.length > (best?.entries.length ?? 0)) best = { letter, entries }
    }
    if (best) out.push(gaussianTiers({ q: `${group.subject} che inizia con la ${best.letter.toUpperCase()}`, c: best.entries, n: [], r: [], e: [], t: [] }))
  }
  return out
}

export const derived: RawQuestion[] = deriveLetterQuestions(builtIn.questions)

/** Every question in the app: written, derived, then uploaded (which replaces one with the same text). */
export function mergeBank(custom: readonly RawQuestion[]): Question[] {
  const byId = new Map<string, Question>()
  for (const raw of [...builtIn.questions, ...derived, ...custom]) {
    const question = compile(raw)
    if (question.answers.length > 0) byId.set(question.id, question)
  }
  return [...byId.values()]
}

/** Adds uploaded questions to the stored ones, replacing those with the same text. */
export function mergeCustom(
  current: readonly RawQuestion[],
  incoming: readonly RawQuestion[],
): { custom: RawQuestion[]; added: number; replaced: number } {
  const byId = new Map(current.map((raw) => [questionId(raw.q), raw]))
  let added = 0
  let replaced = 0
  for (const raw of incoming) {
    const id = questionId(raw.q)
    if (byId.has(id)) replaced++
    else added++
    byId.set(id, raw)
  }
  return { custom: [...byId.values()], added, replaced }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const held = out[i]!
    out[i] = out[j]!
    out[j] = held
  }
  return out
}

/**
 * Questions of one family look alike ("Una città del Giappone", "Una città della Spagna"):
 * the family is the first word that is not an article, and every letter question is one family.
 */
export function family(prompt: string): string {
  if (/ che inizia con la \S+$/i.test(prompt)) return 'lettera'
  return tokenize(prompt)[0] ?? prompt
}

/** Takes `count` questions in the given order, skipping a family already taken while others are left. */
function spread(ordered: readonly Question[], count: number): Question[] {
  const used = new Set<string>()
  const first: Question[] = []
  const rest: Question[] = []
  for (const question of ordered) {
    const kind = family(question.prompt)
    if (first.length < count && !used.has(kind)) {
      used.add(kind)
      first.push(question)
    } else rest.push(question)
  }
  return [...first, ...rest].slice(0, count)
}

/**
 * Never-played questions first, in random order, no two of the same family. When they run out and
 * `repeat` is on, the ones played longest ago come back; with `repeat` off the result can hold
 * fewer than `count`.
 */
export function pickQuestions(
  bank: readonly Question[],
  seen: Readonly<Record<string, number>>,
  count: number,
  repeat = true,
  random: () => number = Math.random,
): Question[] {
  const fresh = shuffle(
    bank.filter((question) => seen[question.id] === undefined),
    random,
  )
  if (fresh.length >= count || !repeat) return spread(fresh, count)
  const played = shuffle(
    bank.filter((question) => seen[question.id] !== undefined),
    random,
  ).sort((a, b) => seen[a.id]! - seen[b.id]!)
  return shuffle(spread([...fresh, ...played], count), random)
}

export function countFresh(bank: readonly Question[], seen: Readonly<Record<string, number>>): number {
  return bank.filter((question) => seen[question.id] === undefined).length
}
