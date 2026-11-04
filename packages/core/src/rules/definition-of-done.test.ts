import { describe, expect, it } from 'vitest'
import { createDefinitionOfDoneItem } from '../entities/definition-of-done-item'
import type { DefinitionOfDoneItem } from '../entities/definition-of-done-item'
import { describeEvent } from './timeline'
import type { TimelineEvent } from '../entities/timeline-event'
import { DefinitionOfDoneNotConfirmedError, NotFoundError, ValidationError } from '../shared/errors'
import {
  toDefinitionOfDoneItemId,
  toEventId,
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import type { DefinitionOfDoneItemId } from '../shared/ids'
import {
  addDefinitionItem,
  assertDefinitionOfDoneConfirmed,
  changedDefinitionItems,
  definitionConfirmedDraft,
  entersDone,
  missingDefinitionItems,
  moveDefinitionItem,
  removeDefinitionItem,
  renameDefinitionItem,
} from './definition-of-done'

const organizationId = toOrganizationId('00000000000000000000000001')
const projectId = toProjectId('00000000000000000000000002')
const actor = toUserId('00000000000000000000000003')

function idOf(n: number): DefinitionOfDoneItemId {
  return toDefinitionOfDoneItemId(`0000000000000000000000${String(n).padStart(4, '0')}`)
}

function itemsOf(...titles: string[]): DefinitionOfDoneItem[] {
  return titles.map((title, position) =>
    createDefinitionOfDoneItem({
      id: idOf(position + 1),
      organizationId,
      projectId,
      title,
      position,
    }),
  )
}

function draft(id: number, title: string) {
  return { id: idOf(id), organizationId, projectId, title }
}

describe('itens da definição de pronto', () => {
  it('cria item com título aparado e rejeita título vazio ou longo', () => {
    expect(itemsOf('  Testes passando  ')[0]?.title).toBe('Testes passando')
    expect(() => itemsOf('   ')).toThrow(ValidationError)
    expect(() => itemsOf('a'.repeat(201))).toThrow(ValidationError)
    expect(itemsOf('a'.repeat(200))[0]?.title).toHaveLength(200)
  })

  it('adiciona no fim e recusa o 21º item do projeto', () => {
    const items = itemsOf('A', 'B')
    const next = addDefinitionItem(items, draft(9, 'C'))
    expect(next.map((item) => [item.title, item.position])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ])
    const full = Array.from({ length: 20 }, (_, index) => `Item ${index + 1}`)
    expect(() => addDefinitionItem(itemsOf(...full), draft(99, 'Extra'))).toThrow(ValidationError)
  })

  it('renomeia sem mudar posições e recusa item inexistente', () => {
    const items = itemsOf('A', 'B')
    const renamed = renameDefinitionItem(items, idOf(2), '  Revisado  ')
    expect(renamed.map((item) => [item.title, item.position])).toEqual([
      ['A', 0],
      ['Revisado', 1],
    ])
    expect(changedDefinitionItems(items, renamed).map((item) => item.id)).toEqual([idOf(2)])
    expect(() => renameDefinitionItem(items, idOf(7), 'X')).toThrow(NotFoundError)
  })

  it('remove e reatribui posições contíguas', () => {
    const { removed, remaining } = removeDefinitionItem(itemsOf('A', 'B', 'C'), idOf(2))
    expect(removed.title).toBe('B')
    expect(remaining.map((item) => [item.title, item.position])).toEqual([
      ['A', 0],
      ['C', 1],
    ])
    expect(() => removeDefinitionItem(itemsOf('A'), idOf(7))).toThrow(NotFoundError)
  })

  it('move (reordena) e reatribui posições', () => {
    const moved = moveDefinitionItem(itemsOf('A', 'B', 'C'), idOf(3), 0)
    expect(moved.map((item) => [item.title, item.position])).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ])
    expect(changedDefinitionItems(itemsOf('A', 'B', 'C'), moved)).toHaveLength(3)
    expect(() => moveDefinitionItem(itemsOf('A', 'B'), idOf(1), 2)).toThrow(ValidationError)
    expect(() => moveDefinitionItem(itemsOf('A', 'B'), idOf(9), 0)).toThrow(NotFoundError)
  })
})

describe('confirmação ao concluir', () => {
  it('projeto sem itens não exige nada', () => {
    expect(() => assertDefinitionOfDoneConfirmed([], [])).not.toThrow()
  })

  it('sem confirmação, o erro traz todos os itens que faltaram', () => {
    const items = itemsOf('Testes passando', 'Documentação atualizada')
    try {
      assertDefinitionOfDoneConfirmed(items, [])
      expect.unreachable('deveria recusar')
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionOfDoneNotConfirmedError)
      expect((error as DefinitionOfDoneNotConfirmedError).code).toBe(
        'DEFINITION_OF_DONE_NOT_CONFIRMED',
      )
      expect((error as DefinitionOfDoneNotConfirmedError).missingItems).toEqual([
        { id: idOf(1), title: 'Testes passando' },
        { id: idOf(2), title: 'Documentação atualizada' },
      ])
    }
  })

  it('confirmação parcial continua faltando os restantes', () => {
    const items = itemsOf('A', 'B', 'C')
    expect(missingDefinitionItems(items, [idOf(1)]).map((item) => item.title)).toEqual(['B', 'C'])
    expect(() => assertDefinitionOfDoneConfirmed(items, [idOf(1), idOf(3)])).toThrow(
      DefinitionOfDoneNotConfirmedError,
    )
  })

  it('confirmar todos os itens libera; ids extras são ignorados', () => {
    const items = itemsOf('A', 'B')
    expect(() => assertDefinitionOfDoneConfirmed(items, [idOf(1), idOf(2), idOf(99)])).not.toThrow()
  })

  it('item adicionado depois da confirmação precisa ser confirmado também', () => {
    const items = itemsOf('A', 'B')
    const confirmed = [idOf(1), idOf(2)]
    expect(() => assertDefinitionOfDoneConfirmed(items, confirmed)).not.toThrow()
    const grown = addDefinitionItem(items, draft(3, 'Revisado por outra pessoa'))
    expect(() => assertDefinitionOfDoneConfirmed(grown, confirmed)).toThrow(
      DefinitionOfDoneNotConfirmedError,
    )
  })

  it('só a mudança para Concluído exige confirmação', () => {
    expect(entersDone('review', 'done')).toBe(true)
    expect(entersDone('planning', 'done')).toBe(true)
    expect(entersDone('done', 'done')).toBe(false)
    expect(entersDone('done', 'review')).toBe(false)
    expect(entersDone('todo', 'in_progress')).toBe(false)
  })

  it('a linha do tempo descreve a confirmação com a contagem de itens', () => {
    const event = (count: number): TimelineEvent => ({
      id: toEventId('00000000000000000000000009'),
      taskId: toTaskId('00000000000000000000000008'),
      at: '2026-01-01T00:00:00.000Z',
      actorUserId: actor,
      asManager: true,
      ...definitionConfirmedDraft(count),
    })
    const names = {
      organizationId,
      user: () => 'Ana',
      contributor: () => 'Cliente',
    }
    const viewer = { userId: actor, organizationId, role: 'manager' as const }
    expect(describeEvent(event(3), viewer, names)).toBe(
      'concluiu a tarefa confirmando a definição de pronto (3 itens)',
    )
    expect(describeEvent(event(1), viewer, names)).toBe(
      'concluiu a tarefa confirmando a definição de pronto (1 item)',
    )
  })
})
