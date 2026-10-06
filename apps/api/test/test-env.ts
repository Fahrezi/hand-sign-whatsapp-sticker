import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_ENV = {
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://hand_sign:hand_sign@localhost:5432/hand_sign_test',
  GOOGLE_CLIENT_ID: 'test-client-id',
  JWT_SECRET: 'test-secret',
  MAX_SIGNS_PER_USER: '5',
  LOG_LEVEL: 'silent',
  // never touch a real bucket from tests, even if apps/api/.env has R2 set
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  R2_BUCKET: '',
  R2_PUBLIC_URL: '',
  UPLOADS_DIR: join(tmpdir(), 'hand-sign-e2e-uploads'),
};
