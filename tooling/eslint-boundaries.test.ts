import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, test } from 'vitest'
import { layers } from './layers.js'

// Os caminhos são virtuais: só estes testes dispensam o projeto TypeScript.
const eslint = new ESLint({ overrideConfig: [tseslint.configs.disableTypeChecked] })

test('mantém as regras com informação de tipos nos arquivos reais', async () => {
  const results = await new ESLint().lintText('Promise.resolve(1)', {
    filePath: 'packages/core/src/index.ts',
  })
  expect(results[0]?.messages).toEqual([
    expect.objectContaining({ ruleId: '@typescript-eslint/no-floating-promises', severity: 2 }),
  ])
}, 15000)

// Pacotes de runtime verificados em cada camada (a tabela diz quais ficam bloqueados).
const RUNTIME_PROBES = ['electron', 'better-sqlite3', 'drizzle-orm']

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

async function lint(source: string, directory: string) {
  const results = await eslint.lintText(source, { filePath: `${directory}/nested/boundary.ts` })
  expect(results).toHaveLength(1)
  const result = results[0]!
  expect(result.messages.filter((message) => message.fatal)).toEqual([])
  return result
}

describe.each(layers)(
  'fronteiras de $directory',
  ({ directory, allowed, forbiddenRuntime, forbidNodeBuiltins }) => {
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

    test('proíbe import relativo que sai da pasta da camada', async () => {
      // O arquivo virtual fica em <camada>/nested/, então '../x' ainda é interno e '../../x' sai.
      const otherLayer = layers.find((layer) => layer.directory !== directory)!.directory
      // Sobe até a raiz do repositório (a pasta da camada + 'nested') e desce até a outra camada.
      const towardsOtherLayer = `${'../'.repeat(directory.split('/').length + 1)}${otherLayer}/src/index`
      const escapes = [
        "import '../../outside'",
        `import '${towardsOtherLayer}'`,
        "export * from '../../outside'",
        "export { value } from '../../outside'",
        "void import('../../outside')",
      ]
      for (const source of escapes) {
        const result = await lint(source, directory)
        expect(result.messages, source).toEqual([
          expect.objectContaining({ ruleId: 'agilebox/no-escaping-imports', severity: 2 }),
        ])
      }
    })

    test('permite import relativo dentro da própria camada', async () => {
      for (const source of [
        "import '../sibling'",
        "import './deep/er'",
        "void import('../sibling')",
      ]) {
        expect((await lint(source, directory)).messages, source).toEqual([])
      }
    })

    for (const name of RUNTIME_PROBES) {
      const blocked = forbiddenRuntime.includes(name) || forbiddenRuntime.includes(`${name}/*`)
      test(`${blocked ? 'proíbe' : 'permite'} o pacote de runtime ${name}`, async () => {
        const result = await lint(`import '${name}'`, directory)
        if (blocked) {
          expect(result.messages).toEqual([
            expect.objectContaining({ ruleId: 'no-restricted-imports', severity: 2 }),
          ])
        } else {
          expect(result.messages).toEqual([])
        }
      })
    }

    test(`${forbidNodeBuiltins ? 'proíbe' : 'permite'} módulos do Node`, async () => {
      for (const specifier of ['node:fs', 'node:path', 'fs', 'path']) {
        const result = await lint(`import '${specifier}'`, directory)
        if (forbidNodeBuiltins) {
          expect(result.messages, specifier).toEqual([
            expect.objectContaining({ ruleId: 'no-restricted-imports', severity: 2 }),
          ])
        } else {
          expect(result.messages, specifier).toEqual([])
        }
      }
    })
  },
)
