import { BadRequestException } from '@nestjs/common';
import {
  CUSTOM_SIGN_FEATURE_VERSION,
  CUSTOM_SIGN_MAX_SAMPLES,
  CUSTOM_SIGN_MIN_SAMPLES,
  CUSTOM_SIGN_NAME_MAX,
  FEATURE_LEN_PER_HAND,
  type Handedness,
  type SignColors,
} from '@hand-sign/shared';

export const SAMPLE_BYTES = FEATURE_LEN_PER_HAND * 4;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CONFETTI_MAX = 16;

export interface ValidSignInput {
  name: string;
  confetti: string;
  colors: SignColors;
  samples: { landmarks: Buffer<ArrayBuffer>; handedness: Handedness }[];
}

function bad(message: string): never {
  throw new BadRequestException(message);
}

function parseData(raw: unknown): Record<string, unknown> {
  let body: Record<string, unknown>;
  try {
    body = typeof raw === 'string' ? JSON.parse(raw) : bad('data is required');
  } catch {
    bad('data must be JSON');
  }
  if (!body || typeof body !== 'object') bad('data must be an object');
  return body;
}

function parseName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > CUSTOM_SIGN_NAME_MAX) bad(`Nama harus 1–${CUSTOM_SIGN_NAME_MAX} karakter`);
  return name;
}

function parseConfetti(value: unknown): string {
  const confetti = typeof value === 'string' ? value.trim() : '';
  if (!confetti || confetti.length > CONFETTI_MAX) bad('Confetti harus 1 emoji');
  return confetti;
}

// Validates the multipart "data" field (UpdateSignRequest JSON).
export function parseUpdateSign(raw: unknown): { name: string; confetti: string } {
  const body = parseData(raw);
  return { name: parseName(body.name), confetti: parseConfetti(body.confetti) };
}

// Validates the multipart "data" field (CreateSignRequest JSON). Never trusts the client.
export function parseCreateSign(raw: unknown): ValidSignInput {
  const body = parseData(raw);

  if (body.handCount === 2) bad('Gestur 2 tangan segera hadir');
  if (body.handCount !== 1) bad('handCount must be 1');
  if (body.featureVersion !== CUSTOM_SIGN_FEATURE_VERSION) bad('Unsupported featureVersion');

  const name = parseName(body.name);
  const confetti = parseConfetti(body.confetti);

  const colors = body.colors as Partial<SignColors> | undefined;
  if (!colors || !COLOR_PATTERN.test(String(colors.dark)) || !COLOR_PATTERN.test(String(colors.light))) {
    bad('colors must be { dark, light } as #rrggbb');
  }

  const samples = body.samples;
  if (!Array.isArray(samples) || samples.length < CUSTOM_SIGN_MIN_SAMPLES || samples.length > CUSTOM_SIGN_MAX_SAMPLES) {
    bad(`Butuh ${CUSTOM_SIGN_MIN_SAMPLES}–${CUSTOM_SIGN_MAX_SAMPLES} sampel`);
  }

  return {
    name,
    confetti,
    colors: { dark: colors.dark!, light: colors.light! },
    samples: samples.map((s: unknown, i) => parseSample(s, i)),
  };
}

function parseSample(raw: unknown, i: number) {
  const s = raw as { landmarks?: unknown; handedness?: unknown } | null;
  if (s?.handedness !== 'Left' && s?.handedness !== 'Right') bad(`samples[${i}].handedness invalid`);
  if (typeof s.landmarks !== 'string') bad(`samples[${i}].landmarks invalid`);
  const landmarks = Buffer.from(s.landmarks, 'base64');
  if (landmarks.length !== SAMPLE_BYTES) bad(`samples[${i}].landmarks must be ${SAMPLE_BYTES} bytes`);
  // MediaPipe image coords: x, y ≈ 0..1 (a little outside when near the edge), z small.
  for (let j = 0; j < FEATURE_LEN_PER_HAND; j++) {
    const v = landmarks.readFloatLE(j * 4);
    const limit = j % 3 === 2 ? 1 : 2;
    if (!Number.isFinite(v) || Math.abs(v) > limit) bad(`samples[${i}].landmarks out of range`);
  }
  return { landmarks, handedness: s.handedness as Handedness };
}

const IMAGE_SIGNATURES: { type: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { type: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  {
    type: 'image/webp',
    ext: 'webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

// Detects the real image type from its bytes; the client-sent mimetype is ignored.
export function sniffImage(buf: Buffer): { type: string; ext: string } {
  const match = IMAGE_SIGNATURES.find((sig) => buf.length >= 12 && sig.test(buf));
  return match ?? bad('Sticker harus PNG, JPG, WEBP, atau GIF');
}
