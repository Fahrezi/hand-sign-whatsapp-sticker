import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from '@mediapipe/tasks-vision'
import { buildTwoHandFeatures, type Sign } from '@hand-sign/shared'
import { HAND_SIGN_CLASSES, score } from './model.js'
import type { CustomSignMatcher } from './customMatcher'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const GESTURE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
const CUSTOM_CONFIDENCE_THRESHOLD = 0.7

export type Detection =
  | { kind: 'match'; sign: Sign; score: number }
  | { kind: 'no-match' }
  | { kind: 'no-hand' }

let recognizerPromise: Promise<GestureRecognizer> | null = null

// Shared across pages: loading the model is slow. A failed load is retried on the next call.
export function getRecognizer(): Promise<GestureRecognizer> {
  recognizerPromise ??= createRecognizer().catch((err) => {
    recognizerPromise = null
    throw err
  })
  return recognizerPromise
}

async function createRecognizer(): Promise<GestureRecognizer> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL)
  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  })
}

function classifyCustomSign(results: GestureRecognizerResult) {
  const probs = score(buildTwoHandFeatures(results.landmarks))
  let bestIdx = 0
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i
  }
  return { id: HAND_SIGN_CLASSES[bestIdx], score: probs[bestIdx] }
}

// Priority: the user's own signs, then the built-in custom model, then MediaPipe's built-in gestures.
export function detectSign(
  results: GestureRecognizerResult,
  signs: Sign[],
  customMatcher: CustomSignMatcher | null = null,
): Detection {
  if (!results.landmarks || results.landmarks.length === 0) return { kind: 'no-hand' }

  const mine = customMatcher?.match(results.landmarks)
  if (mine) return { kind: 'match', sign: mine.sign, score: mine.score }

  const custom = classifyCustomSign(results)
  if (custom.score >= CUSTOM_CONFIDENCE_THRESHOLD) {
    const sign = signs.find((s) => s.source === 'model' && s.id === custom.id)
    if (sign) return { kind: 'match', sign, score: custom.score }
  }

  const top = results.gestures?.[0]?.[0]
  if (top && top.categoryName !== 'None') {
    const sign = signs.find((s) => s.source === 'gesture' && s.gestureName === top.categoryName)
    if (sign) return { kind: 'match', sign, score: top.score }
  }

  return { kind: 'no-match' }
}

export function drawHands(ctx: CanvasRenderingContext2D, results: GestureRecognizerResult) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const drawingUtils = new DrawingUtils(ctx)
  for (const landmarks of results.landmarks ?? []) {
    drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 })
    drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 })
  }
}
