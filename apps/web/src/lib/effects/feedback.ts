import type { Sign } from '@hand-sign/shared'
import { DEFAULT_BG } from '../signs'
import { burstConfetti } from './confetti'
import { EmojiGrid } from './emojiGrid'
import { triggerRipple } from './ripple'

const CONFETTI_FIRST_DELAY_MS = 2000
const CONFETTI_INTERVAL_MS = 3000
const EMOJI_START_DELAY_MS = 2000

export interface FeedbackLayers {
  ripple: HTMLElement
  confetti: HTMLElement
  emoji: HTMLElement
  // element the ripple and confetti originate from (the camera frame)
  origin: HTMLElement
}

// Drives all background feedback from the currently detected sign:
// ripple + background on change, confetti bursts and emoji grid while held.
export class SignFeedback {
  private stableId: string | null = null
  private stableSince = 0
  private lastConfettiAt = 0
  private nextConfettiDelay = CONFETTI_FIRST_DELAY_MS
  private emojiGrid: EmojiGrid

  constructor(private layers: FeedbackLayers) {
    this.emojiGrid = new EmojiGrid(layers.emoji)
  }

  update(sign: Sign | null, now: number) {
    const id = sign?.id ?? null
    if (id !== this.stableId) {
      this.stableId = id
      this.stableSince = now
      this.lastConfettiAt = now
      this.nextConfettiDelay = CONFETTI_FIRST_DELAY_MS
      if (sign) triggerRipple(this.layers.ripple, sign.colors, this.layers.origin.getBoundingClientRect())
      this.setBackground(sign)
      this.emojiGrid.clear()
      return
    }
    if (!sign) return

    if (now - this.lastConfettiAt >= this.nextConfettiDelay) {
      burstConfetti(this.layers.confetti, sign.confetti, this.layers.origin.getBoundingClientRect())
      this.lastConfettiAt = now
      this.nextConfettiDelay = CONFETTI_INTERVAL_MS
    }
    if (this.emojiGrid.currentSrc !== sign.emoji && now - this.stableSince >= EMOJI_START_DELAY_MS) {
      this.emojiGrid.build(sign.emoji)
    }
  }

  destroy() {
    this.emojiGrid.clear()
    this.setBackground(null)
  }

  private setBackground(sign: Sign | null) {
    document.body.style.background = sign
      ? `linear-gradient(to top, ${sign.colors.dark}, ${sign.colors.light})`
      : DEFAULT_BG
  }
}
