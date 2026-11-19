import { defineConfig } from 'vitest/config';

// base './' makes the build work from any sub-path (GitHub Pages, Capacitor, itch.io).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
