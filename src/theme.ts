import { useState } from 'react'

export type ThemePref = 'auto' | 'light' | 'dark'

/** Also read by the inline script in index.html, which applies the theme before the first paint. */
const KEY = 'parkflung:theme'
const BAR = { light: '#f6ecd8', dark: '#141c30' } as const

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'auto') delete root.dataset.theme
  else root.dataset.theme = pref
  // The status bar follows the chosen theme too.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR[pref === 'auto' ? scheme : pref]
  })
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref)
  function choose(next: ThemePref) {
    setPref(next)
    applyTheme(next)
    try {
      if (next === 'auto') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // The choice still applies until the app is closed.
    }
  }
  return [pref, choose]
}
