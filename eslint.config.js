import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { builtinModules } from 'node:module'
import path from 'node:path'
import tseslint from 'typescript-eslint'
import { layers } from './tooling/layers.js'
import { noEscapingImports } from './tooling/no-escaping-imports.js'

const nodeBuiltins = builtinModules.filter((name) => !name.startsWith('_'))

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
  ...layers.map(({ directory, allowed, forbiddenRuntime, forbidNodeBuiltins }) => ({
    files: [`${directory}/**/*.{js,mjs,cjs,ts,tsx}`],
    plugins: { agilebox: { rules: { 'no-escaping-imports': noEscapingImports } } },
    rules: {
      'agilebox/no-escaping-imports': [
        'error',
        { root: path.join(import.meta.dirname, directory) },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...forbiddenRuntime
              .filter((name) => !name.endsWith('*'))
              .map((name) => ({
                name,
                message: 'Pacote de runtime não permitido nesta camada (PLANO 3.1).',
              })),
            ...(forbidNodeBuiltins
              ? nodeBuiltins.map((name) => ({
                  name,
                  message: 'Módulos do Node não são permitidos nesta camada (PLANO 3.1).',
                }))
              : []),
          ],
          patterns: [
            {
              // A lista de permissões também bloqueia pacotes internos futuros.
              regex: `^@agilebox/${allowed.length ? `(?!(?:${allowed.join('|')})(?:/|$))` : ''}`,
              message: 'Importação entre camadas não permitida pela tabela 3.1 do PLANO.',
            },
            ...forbiddenRuntime
              .filter((name) => name.endsWith('*'))
              .map((group) => ({
                group: [group],
                message: 'Pacote de runtime não permitido nesta camada (PLANO 3.1).',
              })),
            ...(forbidNodeBuiltins
              ? [{ group: ['node:*'], message: 'Módulos do Node não são permitidos nesta camada.' }]
              : []),
          ],
        },
      ],
    },
  })),
  prettier,
])
