// How a sign is detected:
// - "model":   built-in custom classifier (model.js)
// - "gesture": MediaPipe built-in gesture, matched by gestureName
// - "custom":  user-recorded sign, matched against its samples (kNN)
export type SignSource = 'model' | 'gesture' | 'custom';

export interface SignColors {
  dark: string;
  light: string;
}

export interface Sign {
  id: string;
  name: string;
  source: SignSource;
  gestureName?: string;
  sticker: string;
  emoji: string;
  confetti: string;
  colors: SignColors;
}

export const SIGN_PACK_SCHEMA_VERSION = 1;

export interface SignPack {
  schemaVersion: typeof SIGN_PACK_SCHEMA_VERSION;
  signs: Sign[];
}

// Item in the user's own sign list (GET /api/signs/mine).
export interface UserSignSummary {
  id: string;
  name: string;
  stickerUrl: string;
  confetti: string;
  createdAt: string;
}

export interface MySignsResponse {
  signs: UserSignSummary[];
  // max custom signs this user may own
  limit: number;
}

// Bump when the capture/feature pipeline changes so old samples can be migrated or ignored.
export const CUSTOM_SIGN_FEATURE_VERSION = 1;
export const CUSTOM_SIGN_MIN_SAMPLES = 30;
export const CUSTOM_SIGN_MAX_SAMPLES = 200;
export const CUSTOM_SIGN_NAME_MAX = 30;
export const STICKER_MAX_BYTES = 2 * 1024 * 1024;
export const STICKER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type Handedness = 'Left' | 'Right';

export interface CustomSignSampleInput {
  // base64 of a Float32Array: 21 landmarks × (x, y, z), raw MediaPipe image coords
  landmarks: string;
  handedness: Handedness;
}

// POST /api/signs is multipart: file "sticker" + field "data" holding this as JSON.
export interface CreateSignRequest {
  name: string;
  // only 1 for now; two-hand signs are "coming soon"
  handCount: 1;
  confetti: string;
  colors: SignColors;
  featureVersion: typeof CUSTOM_SIGN_FEATURE_VERSION;
  samples: CustomSignSampleInput[];
}

// PATCH /api/signs/:id is multipart: optional file "sticker" + field "data" holding this as JSON.
export interface UpdateSignRequest {
  name: string;
  confetti: string;
}

// Everything the client needs to detect and render one custom sign.
export interface CustomSignModel {
  id: string;
  name: string;
  stickerUrl: string;
  emojiUrl: string;
  confetti: string;
  colors: SignColors;
  handCount: number;
  featureVersion: number;
  // base64 Float32Array per sample, same layout as CustomSignSampleInput.landmarks
  samples: string[];
}

export interface CustomSignModelsResponse {
  signs: CustomSignModel[];
}
