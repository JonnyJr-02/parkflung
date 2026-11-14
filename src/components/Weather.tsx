import type { CSSProperties } from 'react'
import { WORLDS } from '../game/tiers'

/** A puffy cloud, 64 × 32 units, drawn from the bottom-left corner. */
export const CLOUD_PATH = 'M8 31 a9 9 0 0 1 3 -17 a13 13 0 0 1 24 -6 a11 11 0 0 1 20 7 a8 8 0 0 1 1 16 z'

/** A lightning bolt, 20 × 40 units. */
export const BOLT_PATH = 'M12 0 L2 22 H9 L5 40 L18 15 H11 L15 0 Z'

/** Clouds of the small weather picture, in % of its box: left, top, width, seconds of delay. */
const STRIP_CLOUDS: ReadonlyArray<ReadonlyArray<[number, number, number, number]>> = [
  [[-4, 2, 30, 0], [22, -8, 34, 3], [52, 4, 30, 6], [76, -6, 34, 2], [8, 34, 26, 5], [64, 30, 28, 1]],
  [[2, 4, 26, 0], [34, -4, 30, 4], [66, 6, 28, 2], [16, 38, 22, 6], [80, 34, 22, 3]],
  [[6, 10, 22, 0], [58, 30, 30, 3], [84, 6, 18, 5]],
  [[10, 12, 16, 0], [70, 8, 14, 4]],
  [[4, 52, 26, 0], [62, 60, 30, 3]],
]

/**
 * Rain, lightning, clouds and sun for one world, as plain elements over a box. The sky colours
 * come from the `world-N` class of the box (styles.css).
 */
export function WeatherLayers({ world }: { world: number }) {
  return (
    <span className="wx" aria-hidden="true">
      {world >= 2 && <span className="wx-sun" />}
      {STRIP_CLOUDS[world]!.map(([left, top, width, delay], index) => (
        <svg
          key={index}
          className="wx-cloud"
          viewBox="0 0 64 32"
          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, animationDelay: `-${delay}s` } as CSSProperties}
        >
          <path d={CLOUD_PATH} />
        </svg>
      ))}
      {world <= 1 && <span className={world === 0 ? 'wx-rain heavy' : 'wx-rain light'} />}
      {world === 0 && (
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

/** The weather of the world the walker is in, on top of the points recap after each answer. */
export function WeatherStrip({ world, arrived = false }: { world: number; arrived?: boolean }) {
  const info = WORLDS[world]!
  return (
    <div className={`weather-strip world-${world}`}>
      <WeatherLayers world={world} />
      <p className="weather-name">
        {arrived ? (
          <>
            <span aria-hidden="true">🏠</span> La casa di Ale è lì!
          </>
        ) : (
          <>
            <span aria-hidden="true">{info.icon}</span> Mondo {world + 1} di 5 · {info.name}
          </>
        )}
      </p>
    </div>
  )
}
