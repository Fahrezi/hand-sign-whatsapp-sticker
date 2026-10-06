const EMOJI_SIZE = 100
const EMOJI_SPEED = 50
const EMOJI_DIRECTIONS = 8

// 8 directions = 360deg / 8 = 45deg apart
const DIRECTION_VECTORS = Array.from({ length: EMOJI_DIRECTIONS }, (_, i) => {
  const angle = i * (360 / EMOJI_DIRECTIONS) * (Math.PI / 180)
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
})

interface Tile {
  el: HTMLImageElement
  x: number
  y: number
  dx: number
  dy: number
}

export class EmojiGrid {
  private tiles: Tile[] = []
  private rafId: number | null = null
  private lastTick: number | null = null
  currentSrc: string | null = null

  constructor(private layer: HTMLElement) {}

  clear() {
    for (const t of this.tiles) t.el.remove()
    this.tiles = []
    this.currentSrc = null
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.lastTick = null
  }

  build(src: string) {
    this.clear()
    const encoded = encodeURI(src)
    const cols = Math.ceil(window.innerWidth / EMOJI_SIZE) + 1
    const rows = Math.ceil(window.innerHeight / EMOJI_SIZE) + 1

    // one shared direction per grid, re-picked each time the sign changes
    const dir = DIRECTION_VECTORS[Math.floor(Math.random() * EMOJI_DIRECTIONS)]

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('img')
        el.src = encoded
        el.className = 'emoji-float'
        el.style.maxWidth = EMOJI_SIZE + 'px'
        el.style.maxHeight = EMOJI_SIZE + 'px'
        const x = c * EMOJI_SIZE
        const y = r * EMOJI_SIZE
        el.style.left = x + 'px'
        el.style.top = y + 'px'
        this.layer.appendChild(el)
        this.tiles.push({ el, x, y, dx: dir.dx, dy: dir.dy })
      }
    }
    this.currentSrc = src
    this.rafId = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    if (this.lastTick === null) this.lastTick = now
    const dt = (now - this.lastTick) / 1000
    this.lastTick = now
    const vw = window.innerWidth
    const vh = window.innerHeight

    for (const t of this.tiles) {
      t.x += t.dx * EMOJI_SPEED * dt
      t.y += t.dy * EMOJI_SPEED * dt
      // wrap around: exit one edge, re-enter from the opposite edge
      if (t.x < -EMOJI_SIZE) t.x = vw
      else if (t.x > vw) t.x = -EMOJI_SIZE
      if (t.y < -EMOJI_SIZE) t.y = vh
      else if (t.y > vh) t.y = -EMOJI_SIZE
      t.el.style.left = t.x + 'px'
      t.el.style.top = t.y + 'px'
    }
    this.rafId = requestAnimationFrame(this.tick)
  }
}
