/**
 * Every sound of the game, made on the spot with Web Audio: no files to download, so the app stays
 * small and works offline. Three buses: effects, music and the sounds of the worlds; the effects
 * follow the «Effetti sonori» switch, music and worlds the «Musica e ambienti» one. Phones only let
 * a page play sound after a touch, so nothing starts until the first tap.
 */
import { getState, subscribe } from './store'
import type { Outcome } from './tiers'

type Bus = 'sfx' | 'music' | 'ambience'
type Tune = 'home'

const BUS_LEVEL: Record<Bus, number> = { sfx: 0.6, music: 0.2, ambience: 0.32 }

let ctx: AudioContext | null = null
let buses: Record<Bus, GainNode> | null = null
let noiseBuffer: AudioBuffer | null = null
let installed = false

/** What the screens asked for; started (again) as soon as sound is allowed. */
let wantedTune: Tune | null = null
let wantedWorld: number | null = null

export function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

function effectsOn(): boolean {
  return getState().soundOn
}

function musicOn(): boolean {
  return getState().musicOn
}

/** The audio clock and buses, once the first tap has unlocked them. */
function ready(): { c: AudioContext; out: Record<Bus, GainNode> } | null {
  if (!ctx || !buses || ctx.state === 'closed') return null
  return { c: ctx, out: buses }
}

function setup(c: AudioContext) {
  const compressor = c.createDynamicsCompressor()
  compressor.threshold.value = -14
  compressor.ratio.value = 4
  compressor.connect(c.destination)
  const make = (bus: Bus) => {
    const gain = c.createGain()
    gain.gain.value = BUS_LEVEL[bus]
    gain.connect(compressor)
    return gain
  }
  buses = { sfx: make('sfx'), music: make('music'), ambience: make('ambience') }
  noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  // iOS wants a sound played inside the tap itself.
  const blank = c.createBufferSource()
  blank.buffer = c.createBuffer(1, 1, c.sampleRate)
  blank.connect(c.destination)
  blank.start()
}

/** Call once: sound unlocks on the first tap or key, pauses when the app is hidden, follows the switches. */
export function installAudio(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const unlock = () => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!ctx) {
      try {
        ctx = new Ctor()
        setup(ctx)
      } catch {
        ctx = null
        return
      }
    }
    if (ctx.state === 'suspended') void ctx.resume()
    applyWanted()
  }
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
  subscribe(applyWanted)
}

// ---------- Building blocks ----------

interface ToneOptions {
  type?: OscillatorType
  gain?: number
  attack?: number
  /** Glide to this frequency by the end. */
  slide?: number
  /** Wobble depth in Hz. */
  vibrato?: number
  /** Low-pass filter cutoff, for softer saw and square waves. */
  cutoff?: number
  bus?: Bus
}

function tone(freq: number, at: number, dur: number, o: ToneOptions = {}) {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, at)
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, at + dur)
  if (o.vibrato) {
    const lfo = c.createOscillator()
    const depth = c.createGain()
    lfo.frequency.value = 6
    depth.gain.value = o.vibrato
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(at)
    lfo.stop(at + dur + 0.1)
  }
  const peak = o.gain ?? 0.3
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + (o.attack ?? 0.012))
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  let node: AudioNode = osc
  if (o.cutoff) {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = o.cutoff
    node.connect(filter)
    node = filter
  }
  node.connect(gain).connect(out[o.bus ?? 'sfx'])
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

interface NoiseOptions {
  filter?: BiquadFilterType
  freq?: number
  /** Sweep the filter to this frequency by the end. */
  sweep?: number
  q?: number
  gain?: number
  attack?: number
  bus?: Bus
}

function noise(at: number, dur: number, o: NoiseOptions = {}) {
  const r = ready()
  if (!r || !noiseBuffer) return
  const { c, out } = r
  const source = c.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const filter = c.createBiquadFilter()
  filter.type = o.filter ?? 'lowpass'
  filter.frequency.setValueAtTime(o.freq ?? 1000, at)
  if (o.sweep) filter.frequency.exponentialRampToValueAtTime(o.sweep, at + dur)
  filter.Q.value = o.q ?? 0.8
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, at + (o.attack ?? 0.005))
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  source.connect(filter).connect(gain).connect(out[o.bus ?? 'sfx'])
  source.start(at, Math.random() * 1.5)
  source.stop(at + dur + 0.05)
}

/** Notes one after the other: [midi note, length in seconds]. */
function melody(notes: ReadonlyArray<readonly [number, number]>, at: number, o: ToneOptions = {}, gap = 0) {
  let time = at
  for (const [note, length] of notes) {
    if (note > 0) tone(midi(note), time, length * 1.4, o)
    time += length + gap
  }
  return time
}

function now(): number | null {
  const r = ready()
  return r && effectsOn() ? r.c.currentTime + 0.01 : null
}

// ---------- Effects ----------

/** Pitch of the walker's steps, left and right. */
let stepSide = 0
/** Fireworks can be many at the house: a little gap between bangs. */
let lastBang = 0

export const sfx = {
  /** A rung of the thermometer lights up: higher and higher. */
  rung(step: number) {
    const t = now()
    if (t === null) return
    tone(midi(74 + step * 3), t, 0.12, { type: 'triangle', gain: 0.22 })
    tone(midi(86 + step * 3), t, 0.08, { gain: 0.06 })
  },

  /** The drum roll while the thermometer climbs; returns the function that stops it. */
  roll(): () => void {
    let stopped = false
    let delay = 150
    let level = 0.04
    const hit = () => {
      if (stopped) return
      const t = now()
      if (t !== null) noise(t, 0.05, { filter: 'bandpass', freq: 2600, q: 0.7, gain: level })
      delay = Math.max(55, delay * 0.95)
      level = Math.min(0.14, level * 1.04)
      window.setTimeout(hit, delay)
    }
    hit()
    return () => {
      stopped = true
    }
  },

  /** The bar pushes on to the rung above. */
  up() {
    const t = now()
    if (t === null) return
    melody([[79, 0.07], [84, 0.07], [88, 0.12]], t, { type: 'triangle', gain: 0.22 })
  },

  /** The bar falls back. */
  down() {
    const t = now()
    if (t === null) return
    tone(260, t, 0.45, { type: 'sawtooth', slide: 110, gain: 0.16, cutoff: 900 })
  },

  /** The rarity, once the thermometer stops: from the sad trombone to Jonny's sparkle. */
  rarity(outcome: Outcome) {
    const t = now()
    if (t === null) return
    switch (outcome) {
      case 'miss': {
        const end = melody([[55, 0.32], [54, 0.32], [53, 0.32]], t + 0.1, { type: 'sawtooth', gain: 0.18, cutoff: 1100 })
        tone(midi(52), end, 1.1, { type: 'sawtooth', gain: 0.18, cutoff: 1100, vibrato: 4 })
        break
      }
      case 'c':
        tone(midi(84), t, 0.6, { gain: 0.22 })
        tone(midi(96), t, 0.4, { gain: 0.05 })
        break
      case 'n':
        melody([[76, 0.12], [81, 0.4]], t, { type: 'triangle', gain: 0.22 })
        break
      case 'r':
        melody([[72, 0.09], [76, 0.09], [79, 0.09], [84, 0.45]], t, { type: 'triangle', gain: 0.22 })
        break
      case 'e':
        melody([[79, 0.08], [83, 0.08], [86, 0.08], [91, 0.5]], t, { type: 'triangle', gain: 0.2 })
        sparkle(t + 0.3, 6)
        break
      case 't':
        // Marco B. gets the fanfare (sfx.fanfare) on its own full screen.
        break
    }
  },

  /** Marco B.: the fanfare. */
  fanfare() {
    const t = now()
    if (t === null) return
    const brass: ToneOptions = { type: 'sawtooth', gain: 0.16, cutoff: 2400 }
    const end = melody([[72, 0.11], [72, 0.11], [72, 0.11], [79, 0.45], [76, 0.14], [79, 0.14]], t, brass, 0.02)
    for (const note of [72, 76, 79, 84]) tone(midi(note), end, 1.4, { ...brass, gain: 0.1 })
    sparkle(end, 10)
  },

  /** One step of the walker. */
  step() {
    const t = now()
    if (t === null) return
    stepSide = 1 - stepSide
    noise(t, 0.07, { freq: stepSide ? 420 : 340, gain: 0.22 })
    tone(stepSide ? 95 : 82, t, 0.06, { gain: 0.12 })
  },

  /** The walker reaches a stop on the trail. */
  stop() {
    const t = now()
    if (t === null) return
    tone(midi(88), t, 1, { gain: 0.14 })
    tone(midi(100), t + 0.02, 0.8, { gain: 0.05 })
  },

  /** A world left behind: a chime that grows with the worlds. */
  world(world: number) {
    const t = now()
    if (t === null) return
    const scale = [72, 76, 79, 84, 88, 91, 96]
    melody(
      scale.slice(0, 3 + world).map((note) => [note, 0.1] as const),
      t + 0.2,
      { type: 'triangle', gain: 0.18 },
    )
    sparkle(t + 0.4 + world * 0.1, 4 + world * 3)
  },

  /** The arrival at the house of Ale: the biggest fanfare. */
  house() {
    const t = now()
    if (t === null) return
    const brass: ToneOptions = { type: 'sawtooth', gain: 0.15, cutoff: 2600 }
    const end = melody(
      [[67, 0.14], [72, 0.14], [76, 0.14], [79, 0.3], [76, 0.14], [79, 0.6], [81, 0.14], [79, 0.14], [77, 0.14], [76, 0.14], [74, 0.14], [72, 0.4]],
      t + 0.3,
      brass,
      0.02,
    )
    for (const note of [60, 64, 67, 72, 76]) tone(midi(note), end, 2, { ...brass, gain: 0.08 })
    sparkle(end, 16)
  },

  /** The questions ran out: a short tune, brighter the further the walker got. */
  over(world: number) {
    const t = now()
    if (t === null) return
    if (world <= 1) melody([[67, 0.2], [64, 0.2], [62, 0.2], [60, 0.6]], t + 0.3, { type: 'triangle', gain: 0.18 })
    else melody([[60, 0.14], [64, 0.14], [67, 0.14], [72, 0.5]], t + 0.3, { type: 'triangle', gain: 0.18 })
    if (world >= 3) sparkle(t + 1, 8)
  },

  /** A fast swish: changing question, turning the card. */
  whoosh() {
    const t = now()
    if (t === null) return
    noise(t, 0.35, { filter: 'bandpass', freq: 500, sweep: 3200, q: 1.2, gain: 0.2, attack: 0.08 })
  },

  /** The answer is not on the list. */
  wrong() {
    const t = now()
    if (t === null) return
    tone(170, t, 0.13, { type: 'square', gain: 0.1, cutoff: 1200 })
    tone(150, t + 0.16, 0.18, { type: 'square', gain: 0.1, cutoff: 1200 })
  },

  /** The "?" square: something is about to happen. */
  mystery() {
    const t = now()
    if (t === null) return
    melody([[60, 0.12], [63, 0.12], [66, 0.12], [69, 0.12], [72, 0.5]], t, { type: 'triangle', gain: 0.18, vibrato: 3 })
  },

  /** The wheel spins: a click every time a slice passes the pointer, slower and slower. */
  wheel(turn: number, seconds: number) {
    const t = now()
    if (t === null) return
    for (const at of wheelTickTimes(turn, seconds)) {
      noise(t + at, 0.025, { filter: 'highpass', freq: 2500, gain: 0.16 })
      tone(1700, t + at, 0.03, { type: 'square', gain: 0.03 })
    }
  },

  /** What the wheel gave: red, blue or gold. */
  prize(kind: 'malus' | 'bonus' | 'gold') {
    const t = now()
    if (t === null) return
    if (kind === 'malus') {
      const end = melody([[60, 0.25], [59, 0.25]], t, { type: 'sawtooth', gain: 0.16, cutoff: 1000 })
      tone(midi(58), end, 0.9, { type: 'sawtooth', gain: 0.16, cutoff: 1000, vibrato: 4 })
    } else if (kind === 'bonus') {
      melody([[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.1], [88, 0.4]], t, { type: 'triangle', gain: 0.2 })
    } else {
      melody([[79, 0.08], [84, 0.08], [88, 0.08], [91, 0.08], [96, 0.6]], t, { type: 'triangle', gain: 0.18 })
      sparkle(t + 0.3, 14)
    }
  },

  /** The Carta Rivincita turns over. */
  card() {
    sfx.whoosh()
    const t = now()
    if (t !== null) sparkle(t + 0.25, 8)
  },

  /** The last seconds of the timer. */
  clock(secondsLeft: number) {
    const t = now()
    if (t === null) return
    tone(secondsLeft <= 1 ? 1400 : 1000, t, 0.05, { type: 'triangle', gain: 0.2 })
  },

  /** Time is up. */
  buzzer() {
    const t = now()
    if (t === null) return
    tone(118, t, 0.6, { type: 'square', gain: 0.12, cutoff: 900 })
    tone(123, t, 0.6, { type: 'square', gain: 0.08, cutoff: 900 })
  },

  /** A firework: the rocket whistles up. */
  rocket() {
    const t = now()
    if (t === null) return
    tone(500, t, 0.7, { gain: 0.035, slide: 1600, attack: 0.05 })
  },

  /** A firework bursts: a bang and a crackle. */
  bang() {
    const t = now()
    if (t === null || t - lastBang < 0.15) return
    lastBang = t
    noise(t, 0.7, { freq: 1600, sweep: 200, gain: 0.32 })
    for (let i = 0; i < 6; i++) noise(t + 0.15 + Math.random() * 0.5, 0.03, { filter: 'highpass', freq: 3500, gain: 0.08 })
  },
}

/** Little high notes, like glitter. */
function sparkle(at: number, count: number) {
  const notes = [84, 86, 88, 91, 93, 96, 98, 100]
  for (let i = 0; i < count; i++) {
    tone(midi(notes[Math.floor(Math.random() * notes.length)]!), at + i * 0.06 + Math.random() * 0.03, 0.25, { gain: 0.05 })
  }
}

/**
 * When the wheel's slices pass the pointer, in seconds from the start of the spin. The wheel slows
 * down like the CSS curve that turns it (fast, then a long gentle stop).
 */
export function wheelTickTimes(turn: number, seconds: number, slice = 72): number[] {
  const ticks: number[] = []
  const crossings = Math.floor(turn / slice)
  for (let k = 1; k <= crossings; k++) {
    const progress = (k * slice) / turn
    ticks.push(seconds * (1 - Math.pow(1 - progress, 1 / 3.2)))
  }
  return ticks
}

// ---------- Music ----------

/** The home tune: a cheerful seaside walk, 8 bars, [midi note, beats]. */
const HOME_MELODY: ReadonlyArray<readonly [number, number]> = [
  [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
  [72, 0.5], [74, 0.5], [76, 1], [79, 1], [76, 1],
  [77, 0.5], [81, 0.5], [84, 1], [81, 0.5], [77, 0.5], [74, 1],
  [76, 0.5], [74, 0.5], [72, 1], [74, 2],
  [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
  [72, 0.5], [74, 0.5], [76, 1], [79, 1], [81, 1],
  [79, 0.5], [77, 0.5], [76, 1], [74, 0.5], [76, 0.5], [77, 1],
  [76, 1], [74, 1], [72, 2],
]
/** One chord root per bar: C C F G C Am G C. */
const HOME_BASS = [48, 48, 53, 55, 48, 57, 55, 48]
const HOME_BEAT = 60 / 104

let tuneTimer = 0
let tuneNext = 0
let tuneStep = 0

function startTune() {
  const r = ready()
  if (!r || tuneTimer) return
  tuneNext = r.c.currentTime + 0.2
  tuneStep = 0
  const melodyStarts: number[] = []
  let beat = 0
  for (const [, length] of HOME_MELODY) {
    melodyStarts.push(beat)
    beat += length
  }
  const loopBeats = beat
  // Schedule a little ahead, one beat at a time.
  tuneTimer = window.setInterval(() => {
    const ready2 = ready()
    if (!ready2) return
    while (tuneNext < ready2.c.currentTime + 0.4) {
      const beatInLoop = tuneStep % loopBeats
      const at = tuneNext
      const bar = Math.floor(beatInLoop / 4)
      const root = HOME_BASS[bar]!
      tone(midi(beatInLoop % 2 === 0 ? root : root + 7), at, HOME_BEAT * 0.9, { type: 'triangle', gain: 0.22, bus: 'music' })
      noise(at, 0.05, { filter: 'highpass', freq: 6000, gain: beatInLoop % 2 ? 0.05 : 0.03, bus: 'music' })
      HOME_MELODY.forEach(([note, length], index) => {
        const start = melodyStarts[index]!
        if (start >= beatInLoop && start < beatInLoop + 1) {
          tone(midi(note), at + (start - beatInLoop) * HOME_BEAT, length * HOME_BEAT * 0.95, { type: 'square', gain: 0.07, cutoff: 1800, bus: 'music' })
        }
      })
      tuneStep += 1
      tuneNext += HOME_BEAT
    }
  }, 80)
}

function stopTune() {
  window.clearInterval(tuneTimer)
  tuneTimer = 0
}

/** The tune for the screen on show: the home tune, or none. */
export function playTune(tune: Tune | null): void {
  wantedTune = tune
  applyWanted()
}

// ---------- The sounds of the worlds ----------

interface Ambience {
  world: number
  gain: GainNode
  sources: AudioScheduledSourceNode[]
  timers: number[]
}

let ambience: Ambience | null = null

function loopNoise(c: AudioContext, into: AudioNode, filter: BiquadFilterType, freq: number, gain: number, q = 0.7) {
  const source = c.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.value = gain
  source.connect(f).connect(g).connect(into)
  source.start(0, Math.random() * 1.5)
  return { source, filter: f, gain: g }
}

function bird(at: number) {
  const base = 2400 + Math.random() * 1400
  const notes = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < notes; i++) tone(base * (1 + Math.random() * 0.3), at + i * 0.11, 0.09, { gain: 0.05, slide: base * 1.5, bus: 'ambience' })
}

function gull(at: number) {
  for (let i = 0; i < 2; i++) tone(1300, at + i * 0.32, 0.28, { type: 'triangle', gain: 0.04, slide: 850, vibrato: 25, bus: 'ambience' })
}

function thunder(at: number) {
  noise(at, 0.25, { filter: 'highpass', freq: 1200, gain: 0.25, bus: 'ambience' })
  noise(at + 0.05, 3.2, { freq: 160, gain: 0.9, attack: 0.15, bus: 'ambience' })
}

function startAmbience(world: number): Ambience | null {
  const r = ready()
  if (!r || !noiseBuffer) return null
  const { c, out } = r
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.5)
  gain.connect(out.ambience)
  const sources: AudioScheduledSourceNode[] = []
  const timers: number[] = []
  // Plays at random intervals, so the world never sounds like a loop.
  const later = (min: number, max: number, play: () => void) => {
    const run = () => {
      timers.push(
        window.setTimeout(() => {
          const ready2 = ready()
          if (ready2) play()
          run()
        }, (min + Math.random() * (max - min)) * 1000),
      )
    }
    run()
  }
  if (world <= 1) {
    // Rain: heavy with thunder in the storm, light with drops in the drizzle.
    const rain = loopNoise(c, gain, 'highpass', world === 0 ? 700 : 1800, world === 0 ? 0.55 : 0.22)
    sources.push(rain.source)
    if (world === 0) later(6, 13, () => thunder(c.currentTime))
    else later(0.3, 1.2, () => tone(1600 + Math.random() * 1200, c.currentTime, 0.05, { gain: 0.03, bus: 'ambience' }))
  } else if (world <= 3) {
    // Wind under the clouds, birds in the sun.
    const wind = loopNoise(c, gain, 'lowpass', 500, world === 2 ? 0.35 : 0.15)
    const lfo = c.createOscillator()
    const depth = c.createGain()
    lfo.frequency.value = 0.09
    depth.gain.value = 260
    lfo.connect(depth).connect(wind.filter.frequency)
    lfo.start()
    sources.push(wind.source, lfo)
    later(world === 2 ? 4 : 1.2, world === 2 ? 9 : 3.5, () => bird(c.currentTime))
  } else {
    // The sunset by the sea: slow waves and a gull now and then.
    const sea = loopNoise(c, gain, 'lowpass', 750, 0.5)
    const swell = c.createOscillator()
    const depth = c.createGain()
    swell.frequency.value = 0.12
    depth.gain.value = 0.4
    swell.connect(depth).connect(sea.gain.gain)
    swell.start()
    sources.push(sea.source, swell)
    later(6, 13, () => gull(c.currentTime))
  }
  return { world, gain, sources, timers }
}

function stopAmbience() {
  const current = ambience
  ambience = null
  if (!current) return
  current.timers.forEach(clearTimeout)
  const r = ready()
  if (!r) return
  const at = r.c.currentTime
  current.gain.gain.cancelScheduledValues(at)
  current.gain.gain.setValueAtTime(Math.max(0.0001, current.gain.gain.value), at)
  current.gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2)
  current.sources.forEach((source) => {
    try {
      source.stop(at + 1.3)
    } catch {
      // Already stopped.
    }
  })
}

/** The sounds of the world the walker is in (0 storm … 4 sunset), or none. */
export function playWorld(world: number | null): void {
  wantedWorld = world
  applyWanted()
}

/** Starts or stops music and worlds to match what the screens asked for and the switches. */
function applyWanted() {
  const r = ready()
  if (!r) return
  const music = musicOn()
  if (music && wantedTune) startTune()
  else stopTune()
  const world = music ? wantedWorld : null
  if (world === null) stopAmbience()
  else if (!ambience || ambience.world !== world) {
    stopAmbience()
    ambience = startAmbience(world)
  }
}
