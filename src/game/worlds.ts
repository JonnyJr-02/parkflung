/**
 * The five worlds of the game, played one after the other: each has its own trail, sky, walker,
 * arrival, imprevisti and tune. A world unlocks when the walker reaches the arrival of the one before.
 */
export type WorldId = 'parcheggio' | 'tigros' | 'casa' | 'varigotti' | 'decanter'

/** The sky over a step: colours and what floats in it (styles.css, `.sky-…`). */
export type SkyId =
  | 'storm'
  | 'drizzle'
  | 'cloudsun'
  | 'sun'
  | 'sunset'
  | 'noon'
  | 'night'
  | 'night-cloudy'
  | 'night-drizzle'
  | 'night-moon'
  | 'night-stars'
  | 'night-starmoon'
  | 'night-dragons'
  | 'wonderland'
  | 'skull'

/** Who walks the trail. */
export type WalkerKind = 'smoker' | 'cart' | 'swimmer' | 'frond' | 'beer'

/** Which wheel of fortune a "?" square spins (surprise.ts). */
export type WheelKind = 'classic' | 'malus' | 'malus-gold' | 'malus-diamond'

export interface StepInfo {
  name: string
  icon: string
  sky: SkyId
  /** The big title when the walker gets into this step (not used for the first). */
  title: string
  note: string
  /** How much the whole scene sways, for the steps where you are not quite sober: 0 … 3. */
  wobble: number
}

/** A "?" square: where it is, its wheel, and whether it can be skipped. */
export interface Spot {
  at: number
  wheel: WheelKind
  forced: boolean
}

export interface WorldInfo {
  id: WorldId
  name: string
  icon: string
  /** One line on the home screen. */
  tagline: string
  /** Points to reach the arrival. */
  target: number
  steps: readonly StepInfo[]
  spots: readonly Spot[]
  walker: WalkerKind
  arrival: {
    /** «alla macchina»: mancano 40 punti alla macchina. */
    to: string
    /** «La macchina è lì!» on the recap when the walker gets there. */
    there: string
    title: string
    /** The button that ends the game. */
    enter: string
  }
}

const WEATHER = {
  storm: { name: 'Temporale', icon: '⛈️', sky: 'storm', title: 'Temporale!', note: 'Pioggia e fulmini.', wobble: 0 },
  drizzle: { name: 'Pioggerella', icon: '🌧️', sky: 'drizzle', title: 'Il temporale è passato!', note: 'Ora pioviggina appena.', wobble: 0 },
  cloudsun: { name: 'Nuvole e sole', icon: '⛅', sky: 'cloudsun', title: 'Spunta il sole!', note: 'Smette di piovere e tra le nuvole esce il sole.', wobble: 0 },
  sun: { name: 'Sole', icon: '☀️', sky: 'sun', title: 'Via le nuvole!', note: 'Il cielo si apre: adesso splende il sole.', wobble: 0 },
} as const satisfies Record<string, StepInfo>

export const WORLDS: readonly WorldInfo[] = [
  {
    id: 'parcheggio',
    name: 'Parcheggio',
    icon: '🅿️',
    tagline: 'Una notte al parcheggio, fino alla macchina col bagagliaio aperto.',
    target: 500,
    walker: 'smoker',
    spots: [{ at: 250, wheel: 'classic', forced: false }],
    steps: [
      { name: 'Sobri', icon: '🙂', sky: 'night-cloudy', title: 'Sobri', note: 'Notte nuvolosa al parcheggio.', wobble: 0 },
      { name: "Un po' fatti", icon: '🌙', sky: 'night-moon', title: "Un po' fatti!", note: 'Esce una bella luna.', wobble: 1 },
      { name: 'Decisamente fatti', icon: '✨', sky: 'night-stars', title: 'Decisamente fatti!', note: 'Il cielo si riempie di stelle.', wobble: 1 },
      { name: 'Fattissimi', icon: '🐉', sky: 'night-dragons', title: 'Fattissimi!', note: 'Tra le stelle volano i draghi.', wobble: 2 },
      { name: 'Jo sta male', icon: '🤢', sky: 'wonderland', title: 'Jo sta male!', note: 'Tutto gira: benvenuti nel paese delle meraviglie.', wobble: 3 },
    ],
    arrival: { to: 'alla macchina', there: 'La macchina è lì!', title: 'Sei arrivato alla macchina!', enter: 'Raggiungi la macchina' },
  },
  {
    id: 'tigros',
    name: 'Tigros',
    icon: '🛒',
    tagline: 'Sul carrello con la bottiglia verde, fino al supermercato.',
    target: 750,
    walker: 'cart',
    spots: [{ at: 375, wheel: 'classic', forced: false }],
    steps: [
      WEATHER.storm,
      WEATHER.drizzle,
      WEATHER.cloudsun,
      WEATHER.sun,
      { name: 'Notte stellata', icon: '🌃', sky: 'night', title: 'È scesa la notte!', note: 'Le stelle e le luci del Tigros.', wobble: 0 },
    ],
    arrival: { to: 'al Tigros', there: 'Il Tigros è lì!', title: 'Sei arrivato al Tigros!', enter: 'Entra al Tigros' },
  },
  {
    id: 'casa',
    name: 'Casa di Ale',
    icon: '🏊',
    tagline: 'Costume e gonfiabile, fino alla casa gialla con la piscina.',
    target: 1000,
    walker: 'swimmer',
    spots: [
      { at: 250, wheel: 'classic', forced: false },
      { at: 750, wheel: 'malus', forced: true },
    ],
    steps: [
      WEATHER.storm,
      WEATHER.drizzle,
      WEATHER.cloudsun,
      WEATHER.sun,
      { name: 'Sole di mezzogiorno', icon: '🌞', sky: 'noon', title: 'Mezzogiorno!', note: 'Il sole è alto: è ora di un tuffo.', wobble: 0 },
    ],
    arrival: { to: 'alla casa di Ale', there: 'La casa di Ale è lì!', title: 'Sei arrivato alla casa di Ale!', enter: 'Tuffati in piscina' },
  },
  {
    id: 'varigotti',
    name: 'Varigotti',
    icon: '🌅',
    tagline: 'Il sentiero sulla riviera, fino alla casa di Ale a Varigotti.',
    target: 1250,
    walker: 'frond',
    spots: [
      { at: 250, wheel: 'classic', forced: false },
      { at: 750, wheel: 'malus', forced: true },
    ],
    steps: [
      WEATHER.storm,
      WEATHER.drizzle,
      WEATHER.cloudsun,
      WEATHER.sun,
      { name: 'Tramonto', icon: '🌅', sky: 'sunset', title: 'Arriva il tramonto!', note: 'Il sole scende sul mare.', wobble: 0 },
    ],
    arrival: {
      to: 'alla casa di Ale a Varigotti',
      there: 'La casa di Ale è lì!',
      title: 'Sei arrivato alla casa di Ale a Varigotti!',
      enter: 'Entra nella casa di Ale',
    },
  },
  {
    id: 'decanter',
    name: 'Decanter',
    icon: '🍺',
    tagline: 'Boccale in mano per le vie di notte, fino al pub.',
    target: 1500,
    walker: 'beer',
    spots: [
      { at: 500, wheel: 'malus-gold', forced: true },
      { at: 1000, wheel: 'malus-diamond', forced: true },
    ],
    steps: [
      { name: 'Sobri', icon: '🙂', sky: 'night-drizzle', title: 'Sobri', note: 'Notte nuvolosa, pioviggina.', wobble: 0 },
      { name: 'Sbrillo', icon: '🍺', sky: 'night-cloudy', title: 'Sbrillo!', note: 'Le nuvole coprono la luna.', wobble: 1 },
      { name: 'Birillo', icon: '🎳', sky: 'night-moon', title: 'Birillo!', note: 'Esce la luna: si barcolla.', wobble: 1 },
      { name: 'Ubriachi', icon: '🥴', sky: 'night-starmoon', title: 'Ubriachi!', note: 'Luna e stelle girano un po\'.', wobble: 2 },
      { name: '💀', icon: '💀', sky: 'skull', title: '💀💀💀', note: 'Ormai è andata.', wobble: 3 },
    ],
    arrival: { to: 'al Decanter', there: 'Il Decanter è lì!', title: 'Sei arrivato al Decanter!', enter: 'Entra al Decanter' },
  },
]

export function isWorldId(value: unknown): value is WorldId {
  return WORLDS.some((world) => world.id === value)
}

export function worldInfo(id: WorldId): WorldInfo {
  return WORLDS.find((world) => world.id === id)!
}

export function worldIndex(id: WorldId): number {
  return WORLDS.findIndex((world) => world.id === id)
}

/** The first world is always open; each other one once the arrival of the world before is reached. */
export function isUnlocked(id: WorldId, reached: readonly WorldId[]): boolean {
  const index = worldIndex(id)
  return index <= 0 || reached.includes(WORLDS[index - 1]!.id)
}

/** The world that opens when the walker reaches the arrival of this one, if any. */
export function nextWorld(id: WorldId): WorldInfo | undefined {
  return WORLDS[worldIndex(id) + 1]
}
