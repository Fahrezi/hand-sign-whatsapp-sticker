const SPEED_PX_PER_S = 10
const MIN_DISTANCE = 50
// new stars are generated in vertical strips this wide, just off the right edge
const STRIP_WIDTH = 100
// placement attempts per MIN_DISTANCE² of area; higher = denser (still never closer than MIN_DISTANCE)
const ATTEMPTS_PER_CELL = 1.5

const SHOOT_INTERVAL_MS = 3000
const SHOOT_MIN_DISTANCE = 150
const SHOOT_MAX_DISTANCE = 300
const SHOOT_SPEED_PX_PER_S = 500
// once the head reaches its end distance it stops and fades out over this long
const SHOOT_FADE_S = 0.4
const SHOOT_TAIL = 80

interface Star {
  x: number
  y: number
  size: number
  alpha: number
}

interface ShootingStar {
  x0: number
  y0: number
  // unit direction
  dx: number
  dy: number
  distance: number
  // seconds since spawn
  age: number
}

// White pixel stars drifting right-to-left across a canvas, randomly spaced
// but never closer than MIN_DISTANCE to each other.
export class Starfield {
  private ctx: CanvasRenderingContext2D
  private stars: Star[] = []
  private shooting: ShootingStar[] = []
  private lastShootAt = 0
  private width = 0
  private height = 0
  // screen x up to which stars have been generated (scrolls with the stars)
  private generatedUntil = 0
  private rafId: number | null = null
  private lastTime = 0
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', this.resize)
    if (this.reducedMotion) this.draw()
    else this.rafId = requestAnimationFrame(this.tick)
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
  }

  private resize = () => {
    const dpr = window.devicePixelRatio || 1
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.stars = []
    this.generatedUntil = 0
    this.fill()
    if (this.reducedMotion) this.draw()
  }

  private tick = (time: number) => {
    // clamp so a backgrounded tab doesn't jump the whole field on return
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0
    this.lastTime = time
    const dx = SPEED_PX_PER_S * dt

    for (const s of this.stars) s.x -= dx
    this.generatedUntil -= dx
    this.stars = this.stars.filter((s) => s.x > -MIN_DISTANCE)
    this.fill()

    if (!this.lastShootAt) this.lastShootAt = time
    if (time - this.lastShootAt >= SHOOT_INTERVAL_MS) {
      this.spawnShootingStar()
      this.lastShootAt = time
    }
    for (const s of this.shooting) s.age += dt
    this.shooting = this.shooting.filter((s) => s.age < s.distance / SHOOT_SPEED_PX_PER_S + SHOOT_FADE_S)
    this.draw()
    this.rafId = requestAnimationFrame(this.tick)
  }

  // random start anywhere on screen, heading down-left (same way the field drifts)
  private spawnShootingStar() {
    const angle = Math.PI - (Math.PI / 9 + Math.random() * (Math.PI / 6)) // 20°–50° below horizontal, leftward
    this.shooting.push({
      x0: Math.random() * this.width,
      y0: Math.random() * this.height,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      distance: SHOOT_MIN_DISTANCE + Math.random() * (SHOOT_MAX_DISTANCE - SHOOT_MIN_DISTANCE),
      age: 0,
    })
  }

  // generate strips until the area just past the right edge is covered
  private fill() {
    while (this.generatedUntil < this.width + MIN_DISTANCE) {
      this.generateStrip(this.generatedUntil, STRIP_WIDTH)
      this.generatedUntil += STRIP_WIDTH
    }
  }

  // rejection sampling: random points, dropped if too close to an existing star
  private generateStrip(x0: number, w: number) {
    const attempts = Math.ceil(((w * this.height) / (MIN_DISTANCE * MIN_DISTANCE)) * ATTEMPTS_PER_CELL)
    for (let i = 0; i < attempts; i++) {
      const x = x0 + Math.random() * w
      const y = Math.random() * this.height
      if (this.isFarEnough(x, y)) {
        this.stars.push({ x, y, size: Math.random() < 0.2 ? 3 : 2, alpha: 0.4 + Math.random() * 0.6 })
      }
    }
  }

  private isFarEnough(x: number, y: number) {
    const min2 = MIN_DISTANCE * MIN_DISTANCE
    for (const s of this.stars) {
      const ddx = s.x - x
      if (ddx > MIN_DISTANCE || ddx < -MIN_DISTANCE) continue
      const ddy = s.y - y
      if (ddx * ddx + ddy * ddy < min2) return false
    }
    return true
  }

  private draw() {
    const { ctx } = this
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = '#fff'
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha
      ctx.fillRect(s.x, s.y, s.size, s.size)
    }
    ctx.globalAlpha = 1

    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const s of this.shooting) {
      const travelTime = s.distance / SHOOT_SPEED_PX_PER_S
      const traveled = Math.min(s.age * SHOOT_SPEED_PX_PER_S, s.distance)
      const opacity = s.age <= travelTime ? 1 : Math.max(0, 1 - (s.age - travelTime) / SHOOT_FADE_S)
      const tail = Math.min(SHOOT_TAIL, traveled)
      const hx = s.x0 + s.dx * traveled
      const hy = s.y0 + s.dy * traveled
      const tx = hx - s.dx * tail
      const ty = hy - s.dy * tail
      const grad = ctx.createLinearGradient(tx, ty, hx, hy)
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
      grad.addColorStop(1, `rgba(255, 255, 255, ${opacity})`)
      ctx.strokeStyle = grad
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(hx, hy)
      ctx.stroke()
    }
  }
}
