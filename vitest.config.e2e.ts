import { defineConfig } from 'vitest/config';
import { testEnv } from './test/setup/test-env.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: testEnv,
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/e2e.setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
