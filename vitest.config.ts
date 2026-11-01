import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      ...['core', 'contract', 'application', 'infra-sqlite', 'ui'].map((name) => ({
        test: {
          name,
          root: `./packages/${name}`,
          environment: name === 'ui' ? 'jsdom' : 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          ...(name === 'ui' ? { setupFiles: ['./vitest.setup.ts'] } : {}),
        },
      })),
      {
        test: {
          name: 'tooling',
          root: './tooling',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'desktop-main',
          root: './apps/desktop',
          environment: 'node',
          include: ['src/main/**/*.test.{ts,tsx}', 'src/preload/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'desktop-renderer',
          root: './apps/desktop',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['../../packages/ui/vitest.setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: {
        'packages/core/src/**': { lines: 95 },
      },
    },
  },
})
