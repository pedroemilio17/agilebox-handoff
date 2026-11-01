import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, test } from 'vitest'

// Os caminhos são virtuais: só estes testes dispensam o projeto TypeScript.
const eslint = new ESLint({ overrideConfig: [tseslint.configs.disableTypeChecked] })

test('mantém as regras com informação de tipos nos arquivos reais', async () => {
  const results = await new ESLint().lintText('Promise.resolve(1)', {
    filePath: 'packages/core/src/index.ts',
  })
  expect(results[0]?.messages).toEqual([
    expect.objectContaining({ ruleId: '@typescript-eslint/no-floating-promises', severity: 2 }),
  ])
})

const internalPackages = [
  'core',
  'contract',
  'application',
  'infra-sqlite',
  'ui',
  'desktop',
  'server',
  'infra-postgres',
  'future-package',
]

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

async function lint(source: string, directory: string) {
  const results = await eslint.lintText(source, { filePath: `${directory}/nested/boundary.ts` })
  expect(results).toHaveLength(1)
  const result = results[0]!
  expect(result.messages.filter((message) => message.fatal)).toEqual([])
  return result
}

describe.each(layers)('fronteiras de $directory', ({ directory, allowed }) => {
  for (const name of internalPackages) {
    const permitted = allowed.includes(name)
    for (const suffix of ['', '/testing']) {
      const specifier = `@agilebox/${name}${suffix}`
      test(`${permitted ? 'permite' : 'proíbe'} ${specifier}`, async () => {
        const result = await lint(`import '${specifier}'`, directory)
        if (permitted) {
          expect(result.messages).toEqual([])
        } else {
          expect(result.messages).toEqual([
            expect.objectContaining({ ruleId: 'no-restricted-imports', severity: 2 }),
          ])
        }
      })
    }
  }

  test('permite um import local', async () => {
    expect((await lint("import './local'", directory)).messages).toEqual([])
  })

  test('também protege imports de tipos e reexportações', async () => {
    const forbidden = internalPackages.find((name) => !allowed.includes(name))!
    const result = await lint(
      `import type { Value } from '@agilebox/${forbidden}'\n` +
        `export type { Value }\nexport * from '@agilebox/${forbidden}/nested'`,
      directory,
    )
    expect(result.messages).toHaveLength(2)
    expect(result.messages.every((message) => message.ruleId === 'no-restricted-imports')).toBe(
      true,
    )
  })
})
