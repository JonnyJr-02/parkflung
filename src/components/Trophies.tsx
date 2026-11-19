import { useLayoutEffect, useState, type RefObject } from 'react'
import { useSavedState } from '../game/store'
import { TROPHIES, type Trophy } from '../game/trophies'
import { WORLDS } from '../game/worlds'

/** A little cup: the trophies button on the home screen. */
export function CupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" />
      <path d="M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11" />
      <path d="M12 14 V17 M8.5 20 H15.5 M9.5 17 H14.5 V20" />
    </svg>
  )
}

function Medal({ trophy, won }: { trophy: Trophy; won: number | undefined }) {
  return (
    <li className={`trophy metal-${trophy.metal}${won ? ' won' : ''}`}>
      <span className="trophy-medal" aria-hidden="true">
        <span className="trophy-icon">{trophy.icon}</span>
        {!won && <span className="trophy-lock">🔒</span>}
      </span>
      <span className="trophy-name">{trophy.seconds ? `${trophy.seconds} s` : trophy.name}</span>
      <span className="sr-only">
        {trophy.name}: {won ? `vinto il ${new Date(won).toLocaleDateString('it-IT')}` : `da vincere. ${trophy.how}`}
      </span>
    </li>
  )
}

/** All the trophies: the two for finishing the game, then four timer trophies for each world. */
export function Trophies({ onBack }: { onBack: () => void }) {
  const saved = useSavedState()
  const won = TROPHIES.filter((trophy) => saved.trophies[trophy.id]).length
  const endings = TROPHIES.filter((trophy) => !trophy.world)
  return (
    <main className="screen trophies">
      <header className="game-top">
        <button type="button" className="link back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5 L8 12 L15 19" />
          </svg>
          Indietro
        </button>
        <p className="game-count">Trofei</p>
        <span />
      </header>

      <section className="trophies-head">
        <p className="trophies-count">
          <strong>{won}</strong> / {TROPHIES.length}
        </p>
        <p className="note">trofei vinti</p>
      </section>

      <section className="panel">
        <h2>Fine del gioco</h2>
        <ul className="trophy-row two">
          {endings.map((trophy) => (
            <Medal key={trophy.id} trophy={trophy} won={saved.trophies[trophy.id]} />
          ))}
        </ul>
        <p className="note">
          {endings.map((trophy) => {
            const done = trophy.id === 'fine-hardcore' ? saved.cleared.hardcore : saved.cleared.easy
            return (
              <span key={trophy.id} className="trophy-how">
                {trophy.icon} {trophy.how}{' '}
                <strong>
                  Fatti: {done.length}/{WORLDS.length}
                  {done.length > 0 ? ` (${WORLDS.filter((world) => done.includes(world.id)).map((world) => world.icon).join(' ')})` : ''}
                </strong>
              </span>
            )
          })}
        </p>
      </section>

      {WORLDS.map((world) => (
        <section key={world.id} className="panel">
          <h2>
            {world.icon} {world.name}
          </h2>
          <ul className="trophy-row">
            {TROPHIES.filter((trophy) => trophy.world === world.id).map((trophy) => (
              <Medal key={trophy.id} trophy={trophy} won={saved.trophies[trophy.id]} />
            ))}
          </ul>
          <p className="note">Arriva {world.arrival.to} con il timer a 15, 30, 45 o 60 secondi per domanda: un trofeo per ogni tempo.</p>
        </section>
      ))}
    </main>
  )
}

/**
 * The first time after the update: the page goes dark except for the new trophies button, with an
 * arrow pointing at it. Only that button can be tapped.
 */
export function TrophyTour({ target }: { target: RefObject<HTMLElement | null> }) {
  const [box, setBox] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const node = target.current
      if (node) setBox(node.getBoundingClientRect())
    }
    measure()
    // Once more when the screen has finished sliding in.
    const timer = window.setTimeout(measure, 320)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [target])

  if (!box) return null
  const pad = 8
  const hole = { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
  const right = hole.left + hole.width
  const bottom = hole.top + hole.height
  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label="Novità: i trofei. Tocca il pulsante Trofei per continuare.">
      {/* Four panes around the hole catch every tap except on the button. */}
      <div className="tour-block" style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} />
      <div className="tour-block" style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
      <div className="tour-block" style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
      <div className="tour-block" style={{ top: hole.top, left: right, right: 0, height: hole.height }} />
      <div className="tour-hole" style={hole} />
      <div className="tour-tip" style={{ top: bottom + 14, right: Math.max(12, window.innerWidth - right - 4) }}>
        <svg className="tour-arrow" viewBox="0 0 60 70" aria-hidden="true">
          <path d="M14 66 C 14 36, 30 18, 48 8" />
          <path d="M34 6 L49 7 L44 21" />
        </svg>
        <p className="tour-text">
          <strong>Novità: i Trofei!</strong>
          Qui trovi tutti i trofei da vincere. Tocca il pulsante per continuare.
        </p>
      </div>
    </div>
  )
}
