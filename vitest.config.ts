import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const rawCssPlugin = {
  name: 'vitest-raw-css',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!source.endsWith('.css?raw') || !importer) return null

    return `\0raw-css-${resolve(dirname(importer), source.slice(0, -'?raw'.length))}.js`
  },
  async load(id: string) {
    if (!id.startsWith('\0raw-css-') || !id.endsWith('.js')) return null

    const cssPath = id.slice('\0raw-css-'.length, -'.js'.length)
    const contents = await readFile(cssPath, 'utf8')
    return `export default ${JSON.stringify(contents)}`
  },
}

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      ...['core', 'contract', 'application', 'infra-sqlite', 'ui'].map((name) => ({
        ...(name === 'ui' ? { plugins: [rawCssPlugin] } : {}),
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
