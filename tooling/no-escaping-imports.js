// Regra local do ESLint: um import relativo não pode sair da pasta da camada.
// O `no-restricted-imports` só enxerga o nome do pacote (`@agilebox/*`); sem esta regra,
// `../../../../packages/infra-sqlite/src` contornaria as fronteiras do PLANO 3.1.
import path from 'node:path'

/** @type {import('eslint').Rule.RuleModule} */
export const noEscapingImports = {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: { root: { type: 'string' } },
        required: ['root'],
        additionalProperties: false,
      },
    ],
    messages: {
      escapes:
        'Import relativo sai da pasta da camada. Use o pacote (@agilebox/*) permitido pela tabela 3.1 do PLANO.',
    },
  },
  create(context) {
    const [{ root }] = /** @type {[{ root: string }]} */ (context.options)
    const layerRoot = path.resolve(root)

    /** @param {import('estree').Node} node @param {unknown} source */
    function check(node, source) {
      if (typeof source !== 'string' || !source.startsWith('.')) return
      const target = path.resolve(path.dirname(context.filename), source)
      const relative = path.relative(layerRoot, target)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        context.report({ node, messageId: 'escapes' })
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node, node.source.value),
    }
  },
}
