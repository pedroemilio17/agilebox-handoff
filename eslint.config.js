import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const layers = [
  { directory: 'packages/core', allowed: [] },
  { directory: 'packages/contract', allowed: [] },
  { directory: 'packages/application', allowed: ['core', 'contract'] },
  { directory: 'packages/infra-sqlite', allowed: ['core', 'application'] },
  { directory: 'packages/ui', allowed: ['core'] },
  {
    directory: 'apps/desktop/src/main',
    allowed: ['core', 'contract', 'application', 'infra-sqlite'],
  },
  { directory: 'apps/desktop/src/preload', allowed: ['contract'] },
  { directory: 'apps/desktop/src/renderer', allowed: ['core', 'contract', 'ui'] },
  {
    directory: 'apps/server',
    allowed: ['core', 'contract', 'application', 'infra-sqlite', 'infra-postgres'],
  },
]

export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      'design/**',
      '.loop/**',
      '**/dist/**',
      '**/out/**',
      '**/coverage/**',
      '**/migrations/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      '*.{js,mjs,cjs,ts}',
      'tooling/**',
      'apps/desktop/src/main/**',
      'apps/desktop/src/preload/**',
      'apps/server/**',
      'packages/infra-sqlite/**',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/ui/**', 'apps/desktop/src/renderer/**'],
    languageOptions: { globals: globals.browser },
  },
  ...layers.map(({ directory, allowed }) => ({
    files: [`${directory}/**/*.{js,mjs,cjs,ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // A lista de permissões também bloqueia pacotes internos futuros.
              regex: `^@agilebox/${allowed.length ? `(?!(?:${allowed.join('|')})(?:/|$))` : ''}`,
              message: 'Importação entre camadas não permitida pela tabela 3.1 do PLANO.',
            },
          ],
        },
      ],
    },
  })),
  prettier,
])
