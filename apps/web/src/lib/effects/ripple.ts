import anime from 'animejs'
import type { SignColors } from '@hand-sign/shared'

let rippleAnim: anime.AnimeInstance | null = null

// Radial flash from the center of `origin`, tinted with the sign's colors.
export function triggerRipple(el: HTMLElement, colors: SignColors, origin: DOMRect) {
  const cx = ((origin.left + origin.width / 2) / window.innerWidth) * 100
  const cy = ((origin.top + origin.height / 2) / window.innerHeight) * 100
  el.style.setProperty('--rx', cx + '%')
  el.style.setProperty('--ry', cy + '%')
  el.style.setProperty('--rlight', colors.light)
  el.style.setProperty('--rdark', colors.dark)
  el.style.setProperty('--rsize', '0%')
  el.style.opacity = '0'

  if (rippleAnim) rippleAnim.pause()
  const state = { size: 0, opacity: 0 }
  rippleAnim = anime({
    targets: state,
    size: [{ value: 150, duration: 1200, easing: 'easeOutExpo' }],
    opacity: [
      { value: 1, duration: 180, easing: 'easeOutQuad' },
      { value: 0, duration: 1000, delay: 100, easing: 'easeInQuad' },
    ],
    update: () => {
      el.style.setProperty('--rsize', state.size + '%')
      el.style.opacity = String(state.opacity)
    },
  })
}
