import anime from 'animejs'

const CONFETTI_COUNT = 50

export function burstConfetti(layer: HTMLElement, emoji: string, rect: DOMRect, count = CONFETTI_COUNT) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = 'confetti-piece'
    el.textContent = emoji
    const size = 16 + Math.random() * 30
    el.style.fontSize = size + 'px'
    el.style.left = rect.left + Math.random() * rect.width + 'px'
    el.style.top = rect.top + 'px'
    layer.appendChild(el)

    const dx = (Math.random() - 0.5) * 320
    const riseHeight = 80 + Math.random() * 180
    const fallHeight = 220 + Math.random() * 220
    const rotate = (Math.random() - 0.5) * 720
    const duration = 1300 + Math.random() * 900

    anime({
      targets: el,
      translateX: dx,
      translateY: [
        { value: -riseHeight, duration: duration * 0.35, easing: 'easeOutQuad' },
        { value: -riseHeight + fallHeight, duration: duration * 0.65, easing: 'easeInQuad' },
      ],
      rotate,
      opacity: [
        { value: 1, duration: 150, easing: 'easeOutQuad' },
        { value: 0, duration: duration * 0.3, delay: duration * 0.55, easing: 'easeInQuad' },
      ],
      easing: 'easeOutQuad',
      complete: () => el.remove(),
    })
  }
}
