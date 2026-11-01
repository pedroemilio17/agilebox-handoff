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
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
    },
  },
})
