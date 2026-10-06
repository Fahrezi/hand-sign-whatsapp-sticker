import { execSync } from 'node:child_process';
import { TEST_ENV } from './test-env.js';

// Brings the e2e database schema up to date before any test runs.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_ENV.DATABASE_URL },
    stdio: 'inherit',
  });
}
