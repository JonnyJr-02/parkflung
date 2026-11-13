import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 30 * 60 * 1000
/** How long the loading bar fills before the new version takes over. */
const LOADING_MS = 1800
const UPDATED_KEY = 'parkflung:updated'

/**
 * A popup in the middle of the screen when a new version has been downloaded. "Aggiorna" fills a
 * loading bar, then the new version takes over and the page reloads; "Più tardi" keeps the
 * current version until the next launch.
 */
export function UpdatePrompt() {
  const [updating, setUpdating] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const updateRef = useRef<HTMLButtonElement>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Installed apps can stay open for days: look for a new version now and then, and on return.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => undefined)
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UPDATED_KEY)) {
        sessionStorage.removeItem(UPDATED_KEY)
        setJustUpdated(true)
        const timer = setTimeout(() => setJustUpdated(false), 2800)
        return () => clearTimeout(timer)
      }
    } catch {
      // Without session storage there is simply no "updated" toast.
    }
  }, [])

  useEffect(() => {
    if (needRefresh) updateRef.current?.focus()
  }, [needRefresh])

  function update() {
    setUpdating(true)
    try {
      sessionStorage.setItem(UPDATED_KEY, '1')
    } catch {
      // Not needed for the update itself.
    }
    window.setTimeout(() => {
      void updateServiceWorker(true)
      // If the new version does not take over by itself, reload anyway.
      window.setTimeout(() => window.location.reload(), 4000)
    }, LOADING_MS)
  }

  return (
    <>
      {needRefresh && (
        <div className="update-backdrop">
          <div className="update" role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
            <p className="update-kicker">Nuova versione</p>
            <h2 id="update-title" className="update-title">
              ParkFlung si è aggiornata
            </h2>
            {updating ? (
              <>
                <p id="update-text" className="update-text">
                  Sto installando l'aggiornamento…
                </p>
                <div
                  className="update-bar"
                  role="progressbar"
                  aria-label="Installazione dell'aggiornamento"
                  style={{ animationDuration: `${LOADING_MS}ms` }}
                >
                  <span />
                </div>
              </>
            ) : (
              <>
                <p id="update-text" className="update-text">
                  Tocca Aggiorna per usarla subito. Se sei in mezzo a una partita, la partita ricomincia.
                </p>
                <button ref={updateRef} type="button" className="btn" onClick={update}>
                  Aggiorna
                </button>
                <button type="button" className="link" onClick={() => setNeedRefresh(false)}>
                  Più tardi
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {justUpdated && (
        <p className="update-toast" role="status">
          Aggiornata alla versione {__APP_VERSION__}
        </p>
      )}
    </>
  )
}
