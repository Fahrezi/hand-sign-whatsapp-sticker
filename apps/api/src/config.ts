import { R2_ENV } from './storage/storage.service.js';

const REQUIRED_ENV = ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'JWT_SECRET'] as const;

// Fails at startup with one clear message instead of on the first request.
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Missing env: ${missing.join(', ')}. Set them in apps/api/.env (see apps/api/.env.example).`,
    );
  }
  // R2 is optional (uploads fall back to local disk), but a half-filled config is a mistake.
  const r2Set = R2_ENV.filter((key) => env[key]);
  if (r2Set.length && r2Set.length !== R2_ENV.length) {
    const r2Missing = R2_ENV.filter((key) => !env[key]);
    throw new Error(`Incomplete R2 config, missing: ${r2Missing.join(', ')}. Set all R2_* vars or none.`);
  }
  return env;
}
