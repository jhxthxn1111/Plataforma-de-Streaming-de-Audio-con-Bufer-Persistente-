import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    fileParallelism: false, // los tests comparten la misma base de datos
    env: { JWT_ACCESS_SECRET: 'secreto-solo-para-tests-0123456789abcdef-0123456789' },
  },
});
