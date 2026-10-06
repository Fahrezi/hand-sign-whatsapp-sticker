import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { TEST_ENV } from './test/test-env.js';

// Needs the local Postgres: `docker compose up -d` at the repo root.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: TEST_ENV,
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
});
