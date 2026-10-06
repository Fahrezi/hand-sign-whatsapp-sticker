import {
  FEATURE_LEN_PER_HAND,
  NUM_LANDMARKS,
  mirrorHandFeatures,
  normalizeHand,
  type Landmark,
  type Sign,
} from '@hand-sign/shared'

// kNN over normalized single-hand features. Each sign is also stored mirrored,
// so a sign recorded with the right hand matches the left hand too.
const K = 5
// Per-sign acceptance radius: p95 of each sample's distance to its nearest
// sibling, times a margin, clamped. Tune these if matching is too strict/loose.
const THRESHOLD_PERCENTILE = 0.95
const THRESHOLD_MARGIN = 1.5
const MIN_THRESHOLD = 0.3
const MAX_THRESHOLD = 1.2

export interface CustomSignData {
  sign: Sign
  // raw landmarks per sample: Float32Array of 21 × (x, y, z)
  samples: Float32Array[]
}

export interface CustomMatch {
  sign: Sign
  // share of the K nearest samples that voted for this sign
  score: number
}

export function landmarksToFloat32(hand: Landmark[]): Float32Array {
  const out = new Float32Array(FEATURE_LEN_PER_HAND)
  hand.forEach((lm, i) => out.set([lm.x, lm.y, lm.z], i * 3))
  return out
}

export function float32ToLandmarks(arr: Float32Array): Landmark[] {
  return Array.from({ length: NUM_LANDMARKS }, (_, i) => ({ x: arr[i * 3], y: arr[i * 3 + 1], z: arr[i * 3 + 2] }))
}

export function handVector(hand: Landmark[]): Float32Array {
  return Float32Array.from(normalizeHand(hand))
}

export function distance(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

function acceptanceRadius(vectors: Float32Array[]): number {
  if (vectors.length < 2) return MIN_THRESHOLD
  const nearest = vectors
    .map((v, i) => Math.min(...vectors.filter((_, j) => j !== i).map((w) => distance(v, w))))
    .sort((a, b) => a - b)
  const p = nearest[Math.min(nearest.length - 1, Math.floor(nearest.length * THRESHOLD_PERCENTILE))]
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, p * THRESHOLD_MARGIN))
}

export class CustomSignMatcher {
  private entries: { signIdx: number; vec: Float32Array }[] = []
  private thresholds: number[]
  private signs: Sign[]

  constructor(data: CustomSignData[]) {
    this.signs = data.map((d) => d.sign)
    this.thresholds = data.map((d, signIdx) => {
      const vectors = d.samples.map((s) => handVector(float32ToLandmarks(s)))
      for (const vec of vectors) {
        this.entries.push({ signIdx, vec }, { signIdx, vec: Float32Array.from(mirrorHandFeatures(vec)) })
      }
      return acceptanceRadius(vectors)
    })
  }

  get isEmpty() {
    return this.entries.length === 0
  }

  // Best match over all visible hands, or null when nothing is close enough.
  match(hands: Landmark[][]): CustomMatch | null {
    let best: CustomMatch | null = null
    for (const hand of hands) {
      const m = this.matchHand(handVector(hand))
      if (m && (!best || m.score > best.score)) best = m
    }
    return best
  }

  private matchHand(vec: Float32Array): CustomMatch | null {
    if (this.isEmpty) return null
    const nearest = this.entries
      .map((e) => ({ signIdx: e.signIdx, d: distance(vec, e.vec) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K)

    const votes = new Map<number, number>()
    for (const n of nearest) votes.set(n.signIdx, (votes.get(n.signIdx) ?? 0) + 1)
    // most votes wins; ties go to the sign that owns the closest sample (first in `nearest`)
    let winner = nearest[0].signIdx
    for (const [idx, count] of votes) if (count > votes.get(winner)!) winner = idx

    const closest = nearest.find((n) => n.signIdx === winner)!.d
    if (closest > this.thresholds[winner]) return null
    return { sign: this.signs[winner], score: votes.get(winner)! / nearest.length }
  }
}
