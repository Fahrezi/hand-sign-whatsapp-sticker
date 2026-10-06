import type { CustomSignModel, CustomSignModelsResponse, Sign, SignColors } from '@hand-sign/shared'
import { api } from './api'
import { auth, loadSession } from './auth.svelte'
import { CustomSignMatcher, type CustomSignData } from './recognition/customMatcher'

export const DEFAULT_STICKER = '/images/sticker/default.png'
export const DEFAULT_BG = '#111'

// Single source of truth for every sign: how it is detected and how it looks.
export const DEFAULT_SIGNS: Sign[] = [
  {
    id: 'give',
    name: 'Give',
    source: 'model',
    sticker: '/images/sticker/give.png',
    emoji: '/images/emoji/give.png',
    confetti: '🤌🏼',
    colors: { dark: '#6b0f3e', light: '#ff9fd6' },
  },
  {
    id: 'izien',
    name: 'Izien',
    source: 'model',
    sticker: '/images/sticker/izien.png',
    emoji: '/images/emoji/izien.png',
    confetti: '🙏🏼',
    colors: { dark: '#0a1f4a', light: '#7ec8ff' },
  },
  {
    id: 'mikier',
    name: 'Mikier',
    source: 'model',
    sticker: '/images/sticker/mikier.png',
    emoji: '/images/emoji/mikier.png',
    confetti: '👉🏼',
    colors: { dark: '#6b3400', light: '#ffb35c' },
  },
  {
    id: 'closed-fist',
    name: 'Closed Fist',
    source: 'gesture',
    gestureName: 'Closed_Fist',
    sticker: '/images/sticker/close-fist.png',
    emoji: '/images/emoji/close fist.png',
    confetti: '✊🏼',
    colors: { dark: '#4a0808', light: '#ff6b6b' },
  },
  {
    id: 'pointing-up',
    name: 'Pointing Up',
    source: 'gesture',
    gestureName: 'Pointing_Up',
    sticker: '/images/sticker/pointing-up.png',
    emoji: '/images/emoji/pointing up.png',
    confetti: '☝🏼',
    colors: { dark: '#5c4b00', light: '#fff176' },
  },
]

export function base64ToFloat32(b64: string): Float32Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Float32Array(bytes.buffer)
}

export function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
  return btoa(String.fromCharCode(...bytes))
}

// Picked color is the light end of the background gradient; dark is the same hue at 35%.
export function colorsFrom(light: string): SignColors {
  const n = parseInt(light.slice(1), 16)
  const dark = [16, 8, 0].map((shift) => Math.round(((n >> shift) & 0xff) * 0.35))
  return { light, dark: '#' + dark.map((c) => c.toString(16).padStart(2, '0')).join('') }
}

function toCustomSignData(m: CustomSignModel): CustomSignData {
  return {
    sign: {
      id: m.id,
      name: m.name,
      source: 'custom',
      sticker: m.stickerUrl,
      emoji: m.emojiUrl,
      confetti: m.confetti,
      colors: m.colors,
    },
    samples: m.samples.map(base64ToFloat32),
  }
}

export interface CustomSigns {
  data: CustomSignData[]
  matcher: CustomSignMatcher
}

// The logged-in user's own signs; empty when logged out.
export async function loadMyCustomSigns(): Promise<CustomSigns> {
  const user = auth.checked ? auth.user : await loadSession().catch(() => null)
  if (!user) return { data: [], matcher: new CustomSignMatcher([]) }
  const res = await api<CustomSignModelsResponse>('/signs/mine/models')
  const data = res.signs.filter((s) => s.handCount === 1).map(toCustomSignData)
  return { data, matcher: new CustomSignMatcher(data) }
}
