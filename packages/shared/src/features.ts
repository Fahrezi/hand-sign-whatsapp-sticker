// Mirrors landmark_utils.py — must stay in sync so JS features match training data.
export const NUM_LANDMARKS = 21;
export const MAX_HANDS = 2;
export const FEATURE_LEN_PER_HAND = NUM_LANDMARKS * 3;
export const FEATURE_LEN = FEATURE_LEN_PER_HAND * MAX_HANDS;

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// One hand → 63 values: wrist-relative, scaled so the farthest point is at distance 1.
export function normalizeHand(landmarks: Landmark[]): number[] {
  const wrist = landmarks[0];
  const rel = landmarks.map((lm) => [lm.x - wrist.x, lm.y - wrist.y, lm.z - wrist.z]);

  let maxDist = 0;
  for (const [x, y, z] of rel) {
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist > maxDist) maxDist = dist;
  }
  if (maxDist === 0) maxDist = 1.0;

  const flat: number[] = [];
  for (const [x, y, z] of rel) {
    flat.push(x / maxDist, y / maxDist, z / maxDist);
  }
  return flat;
}

// hands: array of landmark arrays (0, 1 or 2 hands), each 21 {x,y,z} points
// from the raw (unmirrored) detection frame — same convention as the Python
// scripts, so a given physical two-hand pose lands in the same feature slot.
export function buildTwoHandFeatures(hands: Landmark[][]): number[] {
  const sorted = [...hands].slice(0, MAX_HANDS).sort((a, b) => a[0].x - b[0].x);

  let features: number[] = [];
  for (const hand of sorted) {
    features = features.concat(normalizeHand(hand));
  }
  while (features.length < FEATURE_LEN) {
    features = features.concat(new Array(FEATURE_LEN_PER_HAND).fill(0));
  }
  return features;
}

// Left↔right mirror of normalizeHand output: negates every x, so a sign recorded
// with one hand also matches the same pose made with the other hand.
export function mirrorHandFeatures(features: ArrayLike<number>): number[] {
  return Array.from(features, (v, i) => (i % 3 === 0 && v !== 0 ? -v : v));
}
