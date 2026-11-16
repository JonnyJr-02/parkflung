/**
 * The on-screen keyboard. On the iPhone it covers the bottom of the page without resizing it, so
 * a button fixed to the bottom of the screen ends up under the keys. The visual viewport tells
 * where the visible part ends: while the keyboard is open the page root gets the class
 * `keyboard-open` and `--vv-bottom`, the bottom of the visible part in pixels from the top of the
 * page's fixed layer, so a button can sit just above the keys.
 */
export function installKeyboardWatch(): void {
  const viewport = typeof window !== 'undefined' ? window.visualViewport : null
  if (!viewport) return
  const root = document.documentElement
  const update = () => {
    const bottom = viewport.offsetTop + viewport.height
    // The full height of the page, whichever of the two the browser keeps when the keyboard opens.
    const full = Math.max(window.innerHeight, root.clientHeight)
    const open = full - bottom > 120
    root.classList.toggle('keyboard-open', open)
    root.style.setProperty('--vv-bottom', `${Math.round(bottom)}px`)
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  update()
}
