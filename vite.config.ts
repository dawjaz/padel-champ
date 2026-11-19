import { defineConfig } from 'vitest/config';

// base './' makes the build work from any sub-path (GitHub Pages, Capacitor, itch.io).
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
