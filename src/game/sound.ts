/**
 * The sounds of the game, made on the spot with Web Audio: no files to download, so the app stays
 * small and works offline. One tune per world plays all the time (the «Musica» switch); the only
 * effects are the thermometer and a chime when a step or a world unlocks (the «Effetti sonori»
 * switch). Phones only let a page play sound after a touch, so nothing starts until the first tap.
 */
import { getState, subscribe } from './store'
import type { WorldId } from './worlds'

type Bus = 'sfx' | 'music'

const BUS_LEVEL: Record<Bus, number> = { sfx: 0.6, music: 0.24 }

let ctx: AudioContext | null = null
let buses: Record<Bus, GainNode> | null = null
let noiseBuffer: AudioBuffer | null = null
let installed = false

/** The tune the screens asked for; started (again) as soon as sound is allowed. */
let wantedTune: TuneId | null = null

export function midi(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

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
  buses = { sfx: make('sfx'), music: make('music') }
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
    applyTune()
  }
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
  subscribe(applyTune)
}

// ---------- Building blocks ----------

interface ToneOptions {
  type?: OscillatorType
  gain?: number
  attack?: number
  /** Glide to this frequency by the end. */
  slide?: number
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

function noise(at: number, dur: number, o: { filter?: BiquadFilterType; freq?: number; gain?: number; bus?: Bus } = {}) {
  const r = ready()
  if (!r || !noiseBuffer) return
  const { c, out } = r
  const source = c.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const filter = c.createBiquadFilter()
  filter.type = o.filter ?? 'lowpass'
  filter.frequency.value = o.freq ?? 1000
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, at + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  source.connect(filter).connect(gain).connect(out[o.bus ?? 'sfx'])
  source.start(at, Math.random() * 1.5)
  source.stop(at + dur + 0.05)
}

/** The audio clock, if effects are on and sound is unlocked. */
function now(): number | null {
  const r = ready()
  return r && getState().soundOn ? r.c.currentTime + 0.01 : null
}

// ---------- Effects: the thermometer, and the unlock chime ----------

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
      if (t !== null) noise(t, 0.05, { filter: 'bandpass', freq: 2600, gain: level })
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
    ;[79, 84, 88].forEach((note, i) => tone(midi(note), t + i * 0.07, 0.16, { type: 'triangle', gain: 0.22 }))
  },

  /** The bar falls back. */
  down() {
    const t = now()
    if (t === null) return
    tone(260, t, 0.45, { type: 'sawtooth', slide: 110, gain: 0.16, cutoff: 900 })
  },

  /** A new step of the world, or a new world: a rising chime with a little glitter. */
  unlock(big = false) {
    const t = now()
    if (t === null) return
    const notes = big ? [72, 76, 79, 84, 88, 91, 96] : [76, 79, 84, 88]
    notes.forEach((note, i) => tone(midi(note), t + i * 0.09, 0.5, { type: 'triangle', gain: 0.18 }))
    const glitter = [88, 91, 93, 96, 98, 100]
    for (let i = 0; i < (big ? 14 : 6); i++) {
      tone(midi(glitter[Math.floor(Math.random() * glitter.length)]!), t + 0.3 + i * 0.06, 0.25, { gain: 0.05 })
    }
  },
}

/**
 * When the wheel's slices pass the pointer, in seconds from the start of the spin. Kept for the
 * wheel's timing; the wheel itself makes no sound any more.
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

// ---------- The tunes, one per world, and the song of the credits ----------

/** A world's tune, or the song at the end of the game. */
export type TuneId = WorldId | 'credits'

interface Tune {
  bpm: number
  beatsPerBar: number
  /** [midi note, beats]: a rest is note 0. */
  melody: ReadonlyArray<readonly [number, number]>
  /** One chord root per bar. */
  roots: readonly number[]
  /** Beats of the bar where the bass plays: the root, then the fifth. */
  bassBeats: readonly number[]
  lead: ToneOptions & { length?: number }
  bass: ToneOptions
  /** A soft hi-hat on every beat, louder off the beat. */
  hat: number
}

export const TUNES: Record<TuneId, Tune> = {
  // Parcheggio: a slow night groove in A minor.
  parcheggio: {
    bpm: 84,
    beatsPerBar: 4,
    melody: [
      [69, 1], [72, 0.5], [76, 0.5], [74, 1], [72, 1],
      [69, 1.5], [67, 0.5], [69, 2],
      [72, 1], [76, 0.5], [79, 0.5], [76, 1], [74, 1],
      [72, 1.5], [69, 0.5], [67, 2],
      [69, 1], [72, 0.5], [76, 0.5], [81, 1], [79, 1],
      [76, 1.5], [74, 0.5], [72, 2],
      [74, 1], [76, 0.5], [74, 0.5], [72, 1], [69, 1],
      [69, 4],
    ],
    roots: [57, 57, 60, 55, 57, 52, 50, 57],
    bassBeats: [0, 2],
    lead: { type: 'triangle', gain: 0.12, length: 0.9 },
    bass: { type: 'sine', gain: 0.3 },
    hat: 0.03,
  },
  // Tigros: a bouncy supermarket jingle in C.
  tigros: {
    bpm: 128,
    beatsPerBar: 4,
    melody: [
      [72, 0.5], [76, 0.5], [79, 0.5], [76, 0.5], [84, 1], [79, 1],
      [81, 0.5], [79, 0.5], [77, 0.5], [76, 0.5], [74, 2],
      [74, 0.5], [77, 0.5], [81, 0.5], [77, 0.5], [86, 1], [81, 1],
      [83, 0.5], [81, 0.5], [79, 0.5], [77, 0.5], [76, 2],
      [72, 0.5], [76, 0.5], [79, 0.5], [76, 0.5], [84, 1], [79, 1],
      [81, 0.5], [83, 0.5], [84, 0.5], [81, 0.5], [79, 2],
      [77, 0.5], [76, 0.5], [74, 0.5], [76, 0.5], [77, 0.5], [74, 0.5], [71, 1],
      [72, 4],
    ],
    roots: [48, 53, 50, 55, 48, 57, 55, 48],
    bassBeats: [0, 1, 2, 3],
    lead: { type: 'square', gain: 0.06, cutoff: 2200, length: 0.6 },
    bass: { type: 'triangle', gain: 0.24 },
    hat: 0.05,
  },
  // Casa di Ale: a summer strum in G, short notes like a ukulele.
  casa: {
    bpm: 112,
    beatsPerBar: 4,
    melody: [
      [67, 0.5], [71, 0.5], [74, 1], [71, 0.5], [74, 0.5], [76, 1],
      [74, 0.5], [71, 0.5], [67, 1], [69, 2],
      [72, 0.5], [76, 0.5], [79, 1], [76, 0.5], [74, 0.5], [72, 1],
      [71, 0.5], [69, 0.5], [67, 1], [74, 2],
      [67, 0.5], [71, 0.5], [74, 1], [71, 0.5], [74, 0.5], [76, 1],
      [74, 0.5], [71, 0.5], [67, 1], [76, 2],
      [72, 0.5], [74, 0.5], [76, 1], [74, 0.5], [72, 0.5], [69, 1],
      [67, 4],
    ],
    roots: [55, 55, 60, 50, 55, 52, 50, 55],
    bassBeats: [0, 2],
    lead: { type: 'triangle', gain: 0.14, length: 0.45 },
    bass: { type: 'sine', gain: 0.28 },
    hat: 0.04,
  },
  // Varigotti: the seaside walk of the original game.
  varigotti: {
    bpm: 104,
    beatsPerBar: 4,
    melody: [
      [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
      [72, 0.5], [74, 0.5], [76, 1], [79, 1], [76, 1],
      [77, 0.5], [81, 0.5], [84, 1], [81, 0.5], [77, 0.5], [74, 1],
      [76, 0.5], [74, 0.5], [72, 1], [74, 2],
      [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
      [72, 0.5], [74, 0.5], [76, 1], [79, 1], [81, 1],
      [79, 0.5], [77, 0.5], [76, 1], [74, 0.5], [76, 0.5], [77, 1],
      [76, 1], [74, 1], [72, 2],
    ],
    roots: [48, 48, 53, 55, 48, 57, 55, 48],
    bassBeats: [0, 1, 2, 3],
    lead: { type: 'square', gain: 0.07, cutoff: 1800, length: 0.95 },
    bass: { type: 'triangle', gain: 0.22 },
    hat: 0.04,
  },
  // Decanter: a pub jig in D, six quick beats to the bar.
  decanter: {
    bpm: 300,
    beatsPerBar: 6,
    melody: [
      [74, 1], [78, 1], [81, 1], [78, 1], [81, 1], [86, 1],
      [85, 1], [81, 1], [78, 1], [76, 3],
      [74, 1], [78, 1], [81, 1], [83, 1], [81, 1], [78, 1],
      [79, 1], [76, 1], [73, 1], [74, 3],
      [74, 1], [78, 1], [81, 1], [78, 1], [81, 1], [86, 1],
      [86, 1], [83, 1], [79, 1], [81, 3],
      [78, 1], [81, 1], [78, 1], [76, 1], [74, 1], [73, 1],
      [74, 6],
    ],
    roots: [50, 57, 50, 57, 50, 55, 57, 50],
    bassBeats: [0, 3],
    lead: { type: 'square', gain: 0.06, cutoff: 2600, length: 0.9 },
    bass: { type: 'triangle', gain: 0.26 },
    hat: 0.035,
  },
  // The credits: a slow, warm goodbye song in F, long notes, a little nostalgic.
  credits: {
    bpm: 72,
    beatsPerBar: 4,
    melody: [
      [72, 1.5], [70, 0.5], [69, 1], [65, 1],
      [67, 1], [69, 0.5], [70, 0.5], [72, 2],
      [74, 1.5], [72, 0.5], [69, 1], [74, 1],
      [72, 1], [70, 1], [69, 2],
      [72, 1.5], [70, 0.5], [69, 1], [65, 1],
      [67, 1], [69, 0.5], [70, 0.5], [72, 1], [76, 1],
      [77, 1.5], [76, 0.5], [74, 1], [70, 1],
      [69, 1], [67, 1], [65, 2],
    ],
    roots: [53, 48, 50, 46, 53, 48, 46, 53],
    bassBeats: [0, 2],
    lead: { type: 'triangle', gain: 0.14, length: 0.95 },
    bass: { type: 'sine', gain: 0.26 },
    hat: 0.015,
  },
}

let tuneTimer = 0
let tunePlaying: TuneId | null = null

function startTune(id: TuneId) {
  const r = ready()
  if (!r || tunePlaying === id) return
  stopTune()
  tunePlaying = id
  const tune = TUNES[id]
  const beat = 60 / tune.bpm
  const starts: number[] = []
  let total = 0
  for (const [, length] of tune.melody) {
    starts.push(total)
    total += length
  }
  let next = r.c.currentTime + 0.25
  let step = 0
  // Schedule a little ahead, one beat at a time.
  tuneTimer = window.setInterval(() => {
    const live = ready()
    if (!live) return
    while (next < live.c.currentTime + 0.4) {
      const inLoop = step % total
      const inBar = inLoop % tune.beatsPerBar
      const root = tune.roots[Math.floor(inLoop / tune.beatsPerBar) % tune.roots.length]!
      const bassIndex = tune.bassBeats.indexOf(inBar)
      if (bassIndex >= 0) tone(midi(bassIndex % 2 === 0 ? root : root + 7), next, beat * 1.6, { ...tune.bass, bus: 'music' })
      noise(next, 0.05, { filter: 'highpass', freq: 6000, gain: inBar % 2 ? tune.hat : tune.hat * 0.6, bus: 'music' })
      tune.melody.forEach(([note, length], index) => {
        const start = starts[index]!
        if (note > 0 && start >= inLoop && start < inLoop + 1) {
          tone(midi(note), next + (start - inLoop) * beat, Math.max(0.12, length * beat * (tune.lead.length ?? 0.9)), {
            ...tune.lead,
            bus: 'music',
          })
        }
      })
      step += 1
      next += beat
    }
  }, 80)
}

function stopTune() {
  window.clearInterval(tuneTimer)
  tuneTimer = 0
  tunePlaying = null
}

/** The tune of a world, the song of the credits, or none. */
export function playTune(tune: TuneId | null): void {
  wantedTune = tune
  applyTune()
}

function applyTune() {
  if (!ready()) return
  if (getState().musicOn && wantedTune) startTune(wantedTune)
  else stopTune()
}
