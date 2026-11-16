/*
 * On a tall, narrow phone the poster gets taller instead of losing its sides: the sky keeps its
 * height and moves up, the land under the horizon stretches down to the bottom of the screen, and
 * the trail with it, so its bends grow taller and fill the screen. The things on the land (trees,
 * lamps, the start, the arrival…) keep their size and only move, with the ground under them.
 *
 * Units are those of the land layer (the poster 60 units down): the bottom of the poster is at 500.
 */

/** Where the land starts to stretch: above it everything only moves up. */
export const HORIZON = 250
const BOTTOM = 500

export type MapY = (y: number) => number

/**
 * The vertical map for `lift` more units of height: everything above the horizon moves up by
 * `lift`, the bottom stays where it is, and the land in between stretches evenly.
 */
export function stretchMap(lift: number): MapY {
  if (lift <= 0) return (y) => y
  const k = (BOTTOM - HORIZON + lift) / (BOTTOM - HORIZON)
  return (y) => (y <= HORIZON ? y - lift : HORIZON - lift + (y - HORIZON) * k)
}

/**
 * The same path with its points moved by `mapY`. Only absolute commands (M, L, C, Q, S, T, H, V,
 * Z) are expected, as in the trail and the hills.
 */
export function mapPath(d: string, mapY: MapY): string {
  const out: string[] = []
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let command = ''
  let index = 0
  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      if (token !== token.toUpperCase() && token !== 'z') throw new Error(`Relative command ${token} in ${d}`)
      command = token.toUpperCase()
      index = 0
      out.push(token)
      continue
    }
    const value = Number(token)
    let mapped = value
    if (command === 'V') mapped = mapY(value)
    else if (command !== 'H' && index % 2 === 1) mapped = mapY(value)
    out.push(String(Math.round(mapped * 100) / 100))
    index += 1
  }
  return out.join(' ')
}

/** The bottom of an element in the coordinates of its parent, its own transform included. */
function bottomOf(element: SVGGraphicsElement): number | null {
  let box: DOMRect
  try {
    box = element.getBBox()
  } catch {
    return null
  }
  if (!box.width && !box.height) return null
  const matrix = element.transform.baseVal.consolidate()?.matrix
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ]
  return Math.max(...corners.map(([x, y]) => (matrix ? matrix.b * x! + matrix.d * y! + matrix.f : y!)))
}

function isCluster(element: Element): boolean {
  // A plain group of little dots or squares spread over the land (flowers, lit windows): each moves on its own.
  return (
    element.tagName.toLowerCase() === 'g' &&
    !element.hasAttribute('transform') &&
    element.children.length > 1 &&
    Array.from(element.children).every((child) => ['circle', 'rect', 'ellipse'].includes(child.tagName.toLowerCase()))
  )
}

/** How many numbers each relative command takes, and where its end point's y is. */
const RELATIVE: Record<string, [number, number | null]> = {
  l: [2, 1], h: [1, null], v: [1, 0], q: [4, 3], c: [6, 5], t: [2, 1], s: [4, 3], a: [7, 6],
}

/**
 * A path made of several far-apart pieces, each an absolute M followed only by relative commands
 * (the stripes of two rows of parking spaces): each piece moves with the ground under its own
 * bottom. Null when the path is not like that, or its pieces are close together.
 */
export function movePieces(d: string, mapY: MapY): string | null {
  const pieces = d.trim().split(/(?=M)/)
  if (pieces.length < 2) return null
  const parsed = []
  for (const piece of pieces) {
    const match = piece.match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)([^A-Z]*)$/)
    if (!match) return null
    const [, x, y, rest] = match
    let at = Number(y)
    let bottom = at
    let command = ''
    let numbers: number[] = []
    const flush = () => {
      const rule = RELATIVE[command]
      if (!rule) return
      const [size, yIndex] = rule
      for (let start = 0; start + size <= numbers.length; start += size) {
        if (yIndex !== null) at += numbers[start + yIndex]!
        bottom = Math.max(bottom, at)
      }
    }
    for (const token of rest!.match(/[a-z]|-?\d*\.?\d+/g) ?? []) {
      if (/[a-z]/.test(token)) {
        flush()
        command = token
        numbers = []
      } else numbers.push(Number(token))
    }
    flush()
    parsed.push({ x: Number(x), y: Number(y), rest: rest!.trimEnd(), bottom })
  }
  const bottoms = parsed.map((piece) => piece.bottom)
  if (Math.max(...bottoms) - Math.min(...bottoms) < 40) return null
  return parsed
    .map((piece) => `M${piece.x} ${Math.round((piece.y + mapY(piece.bottom) - piece.bottom) * 100) / 100}${piece.rest}`)
    .join(' ')
}

/**
 * Moves each thing inside the `[data-tall]` groups of `root` with the ground under it (the bottom
 * of the thing), keeping its size. With `mapY` the identity everything goes back where it was.
 */
export function placeOnStretchedLand(root: Element, mapY: MapY): void {
  const things: SVGGraphicsElement[] = []
  root.querySelectorAll('[data-tall]').forEach((group) => {
    for (const child of Array.from(group.children)) {
      if (isCluster(child)) {
        things.push(...(Array.from(child.children) as SVGGraphicsElement[]))
        continue
      }
      // A path of far-apart pieces: each piece moves on its own.
      if (child.tagName.toLowerCase() === 'path' && !child.hasAttribute('transform')) {
        const path = child as SVGPathElement
        const original = path.dataset.d0 ?? path.getAttribute('d') ?? ''
        const moved = movePieces(original, mapY)
        if (moved !== null) {
          path.dataset.d0 = original
          path.setAttribute('d', moved)
          continue
        }
      }
      things.push(child as SVGGraphicsElement)
    }
  })
  for (const thing of things) {
    const original = thing.dataset.t0 ?? thing.getAttribute('transform') ?? ''
    thing.dataset.t0 = original
    if (original) thing.setAttribute('transform', original)
    else thing.removeAttribute('transform')
    const bottom = bottomOf(thing)
    if (bottom === null) continue
    const dy = mapY(bottom) - bottom
    if (Math.abs(dy) < 0.01) continue
    thing.setAttribute('transform', `translate(0 ${dy.toFixed(2)})${original ? ` ${original}` : ''}`)
  }
}
