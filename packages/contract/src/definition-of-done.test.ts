import { describe, expect, it } from 'vitest'
import {
  addDefinitionOfDoneItemInputSchema,
  definitionOfDoneItemDtoSchema,
  moveDefinitionOfDoneItemInputSchema,
} from './definition-of-done'
import { failureResult } from './result'

const projectId = '01J8Y4G2XK8Z1S6M3Q9W0A5P01'
const itemId = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'

describe('schemas da definição de pronto', () => {
  it('apara o título e recusa vazio ou com mais de 200 caracteres', () => {
    expect(addDefinitionOfDoneItemInputSchema.parse({ projectId, title: '  Testes  ' })).toEqual({
      projectId,
      title: 'Testes',
    })
    expect(addDefinitionOfDoneItemInputSchema.safeParse({ projectId, title: '   ' }).success).toBe(
      false,
    )
    expect(
      addDefinitionOfDoneItemInputSchema.safeParse({ projectId, title: 'a'.repeat(201) }).success,
    ).toBe(false)
  })

  it('aceita item com posição inteira não negativa', () => {
    expect(
      definitionOfDoneItemDtoSchema.parse({ id: itemId, projectId, title: 'A', position: 0 }),
    ).toMatchObject({ position: 0 })
    expect(
      moveDefinitionOfDoneItemInputSchema.safeParse({ projectId, itemId, position: -1 }).success,
    ).toBe(false)
  })

  it('o resultado de erro carrega os itens que faltaram na conclusão', () => {
    expect(
      failureResult('DEFINITION_OF_DONE_NOT_CONFIRMED', 'Confirme', [
        { id: itemId, title: 'Testes passando' },
      ]),
    ).toEqual({
      ok: false,
      error: {
        code: 'DEFINITION_OF_DONE_NOT_CONFIRMED',
        message: 'Confirme',
        missingItems: [{ id: itemId, title: 'Testes passando' }],
      },
    })
    expect(failureResult('VALIDATION', 'x')).toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'x' },
    })
  })
})
