import type { CSSProperties } from 'react'
import type { SkyId, WorldInfo } from '../game/worlds'
import { SKY_FEATURES } from './Art'

/** A puffy cloud, 64 × 32 units, drawn from the bottom-left corner. */
export const CLOUD_PATH = 'M8 31 a9 9 0 0 1 3 -17 a13 13 0 0 1 24 -6 a11 11 0 0 1 20 7 a8 8 0 0 1 1 16 z'

/** A lightning bolt, 20 × 40 units. */
export const BOLT_PATH = 'M12 0 L2 22 H9 L5 40 L18 15 H11 L15 0 Z'

/** Clouds of the small sky picture, in % of its box: left, top, width, seconds of delay; by cloud set. */
const STRIP_CLOUDS: ReadonlyArray<ReadonlyArray<[number, number, number, number]>> = [
  [[-4, 2, 30, 0], [22, -8, 34, 3], [52, 4, 30, 6], [76, -6, 34, 2], [8, 34, 26, 5], [64, 30, 28, 1]],
  [[2, 4, 26, 0], [34, -4, 30, 4], [66, 6, 28, 2], [16, 38, 22, 6], [80, 34, 22, 3]],
  [[6, 10, 22, 0], [58, 30, 30, 3], [84, 6, 18, 5]],
  [[10, 12, 16, 0], [70, 8, 14, 4]],
  [[4, 52, 26, 0], [62, 60, 30, 3]],
]

/** Stars of the small sky picture, in % of its box. */
const STRIP_STARS: ReadonlyArray<[number, number]> = [
  [6, 20], [16, 60], [27, 14], [38, 44], [48, 22], [57, 66], [66, 12], [74, 40], [84, 18], [93, 56], [12, 82], [44, 80], [80, 76],
]

/**
 * Rain, lightning, clouds, sun, moon, stars and the odd skull for one sky, as plain elements over
 * a box. The sky colours come from the `sky-…` class of the box (styles.css).
 */
export function WeatherLayers({ sky }: { sky: SkyId }) {
  const features = SKY_FEATURES[sky]
  return (
    <span className="wx" aria-hidden="true">
      {features.stars && STRIP_STARS.map(([left, top], index) => (
        <span key={index} className="wx-star" style={{ left: `${left}%`, top: `${top}%`, '--i': index % 5 } as CSSProperties} />
      ))}
      {features.moon && <span className="wx-moon" />}
      {!features.night && sky !== 'storm' && sky !== 'drizzle' && <span className="wx-sun" />}
      {features.clouds !== null &&
        STRIP_CLOUDS[features.clouds]!.map(([left, top, width, delay], index) => (
          <svg
            key={index}
            className="wx-cloud"
            viewBox="0 0 64 32"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, animationDelay: `-${delay}s` } as CSSProperties}
          >
            <path d={CLOUD_PATH} />
          </svg>
        ))}
      {features.dragons && <span className="wx-emoji wx-dragon">🐉</span>}
      {features.wonderland && <span className="wx-emoji wx-wonder">🍄🃏</span>}
      {features.skulls && <span className="wx-emoji wx-skull">💀</span>}
      {features.rain > 0 && <span className={features.rain === 2 ? 'wx-rain heavy' : 'wx-rain light'} />}
      {features.bolt && (
        <>
          <span className="wx-flash" />
          <svg className="wx-bolt" viewBox="0 0 20 40">
            <path d={BOLT_PATH} />
          </svg>
        </>
      )}
    </span>
  )
}

/** The step of the world the walker is in, on top of the points recap after each answer. */
export function WeatherStrip({ world, step, arrived = false }: { world: WorldInfo; step: number; arrived?: boolean }) {
  const info = world.steps[step]!
  return (
    <div className={`weather-strip sky-${info.sky}`}>
      <WeatherLayers sky={info.sky} />
      <p className="weather-name">
        {arrived ? (
          <>
            <span aria-hidden="true">🏁</span> {world.arrival.there}
          </>
        ) : (
          <>
            <span aria-hidden="true">{info.icon}</span> Step {step + 1} di 5 · {info.name}
          </>
        )}
      </p>
    </div>
  )
}
