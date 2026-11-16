import { describe, expect, it } from 'vitest'
import { createAcceptanceCriterion } from '../entities/acceptance-criterion'
import type { AcceptanceCriterion } from '../entities/acceptance-criterion'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import { ConflictError, ValidationError } from '../shared/errors'
import {
  toAcceptanceCriterionId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import type { AcceptanceCriterionId } from '../shared/ids'
import {
  acceptanceEventDraft,
  addAcceptanceCriterion,
  changedAcceptancePositions,
  moveAcceptanceCriterion,
  removeAcceptanceCriterion,
  renameAcceptanceCriterion,
  setAcceptanceDone,
} from './acceptance'

const id = (n: number) => `0000000000000000000000000${n}`
const org = toOrganizationId(id(1))
const at = '2026-01-02T10:00:00.000Z'

function aTask(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({
      id: toTaskId(id(1)),
      organizationId: org,
      number: 1,
      projectId: toProjectId(id(1)),
      projectName: 'Projeto',
      createdBy: toUserId(id(2)),
      title: 'Tarefa',
      createdAt: '2026-01-01T00:00:00.000Z',
      responsibleParticipationId: toParticipationId(id(3)),
      responsibleRateCents: 4500,
    }),
    ...overrides,
  }
}

function criterion(
  n: number,
  position: number,
  overrides: Partial<Pick<AcceptanceCriterion, 'text' | 'done'>> = {},
): AcceptanceCriterion {
  return createAcceptanceCriterion({
    id: toAcceptanceCriterionId(`0000000000000000000000${String(n).padStart(4, '0')}`),
    organizationId: org,
    taskId: toTaskId(id(1)),
    text: overrides.text ?? `Critério ${n}`,
    done: overrides.done ?? false,
    position,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
}

const criterionId = (n: number): AcceptanceCriterionId =>
  toAcceptanceCriterionId(`0000000000000000000000${String(n).padStart(4, '0')}`)

function listOf(count: number): AcceptanceCriterion[] {
  return Array.from({ length: count }, (_, index) => criterion(index + 1, index))
}

describe('critérios: texto e criação', () => {
  it('novo critério vai para o fim, não concluído, com o texto sem espaços', () => {
    const created = addAcceptanceCriterion(aTask(), listOf(2), {
      id: criterionId(9),
      text: '  Testado no Windows  ',
      createdAt: at,
    })
    expect(created).toMatchObject({ text: 'Testado no Windows', done: false, position: 2 })
    expect(created.updatedAt).toBe(at)
  })

  it('aceita até 200 caracteres, contando letras acentuadas como um caractere', () => {
    const added = addAcceptanceCriterion(aTask(), [], {
      id: criterionId(9),
      text: 'ç'.repeat(200),
      createdAt: at,
    })
    expect(added.text).toHaveLength(200)
  })

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['201 caracteres', 'x'.repeat(201)],
  ])('recusa texto %s', (_label, text) => {
    expect(() =>
      addAcceptanceCriterion(aTask(), [], { id: criterionId(9), text, createdAt: at }),
    ).toThrow(ValidationError)
  })

  it('aceita até 20 critérios e recusa o 21º', () => {
    const twenty = listOf(19)
    expect(
      addAcceptanceCriterion(aTask(), twenty, {
        id: criterionId(20),
        text: 'Vigésimo',
        createdAt: at,
      }).position,
    ).toBe(19)
    expect(() =>
      addAcceptanceCriterion(aTask(), listOf(20), {
        id: criterionId(21),
        text: 'Extra',
        createdAt: at,
      }),
    ).toThrow('Limite de 20 critérios por tarefa')
  })

  it('posição do critério criado deve ser inteira e não negativa', () => {
    expect(() => createAcceptanceCriterion({ ...criterion(1, 0), position: -1 })).toThrow(
      ValidationError,
    )
    expect(() => createAcceptanceCriterion({ ...criterion(1, 0), position: 1.5 })).toThrow(
      ValidationError,
    )
  })
})

describe('critérios: marcar, renomear e remover', () => {
  it('marca e desmarca, atualizando a data de alteração', () => {
    const [first] = listOf(1)
    if (!first) throw new Error('fixture')
    const done = setAcceptanceDone(aTask(), first, true, at)
    expect(done).toMatchObject({ done: true, updatedAt: at })
    expect(setAcceptanceDone(aTask(), done, false, at).done).toBe(false)
  })

  it('marcar do mesmo jeito devolve o mesmo critério (sem evento)', () => {
    const [first] = listOf(1)
    if (!first) throw new Error('fixture')
    expect(setAcceptanceDone(aTask(), first, false, at)).toBe(first)
  })

  it('renomeia valida o texto e não muda nada se o texto é igual', () => {
    const [first] = listOf(1)
    if (!first) throw new Error('fixture')
    expect(renameAcceptanceCriterion(aTask(), first, 'Critério 1', at)).toBe(first)
    expect(renameAcceptanceCriterion(aTask(), first, ' Novo ', at).text).toBe('Novo')
    expect(() => renameAcceptanceCriterion(aTask(), first, '', at)).toThrow(ValidationError)
  })

  it('remove e reatribui as posições', () => {
    const { removed, remaining } = removeAcceptanceCriterion(aTask(), listOf(3), criterionId(2))
    expect(removed.id).toBe(criterionId(2))
    expect(remaining.map((c) => [c.text, c.position])).toEqual([
      ['Critério 1', 0],
      ['Critério 3', 1],
    ])
  })

  it('remover critério que não existe recusa', () => {
    expect(() => removeAcceptanceCriterion(aTask(), listOf(2), criterionId(9))).toThrow(
      ValidationError,
    )
  })
})

describe('critérios: ordem', () => {
  it('move para outra posição e renumera de 0 a n-1', () => {
    const moved = moveAcceptanceCriterion(aTask(), listOf(3), criterionId(1), 2)
    expect(moved.map((c) => [c.text, c.position])).toEqual([
      ['Critério 2', 0],
      ['Critério 3', 1],
      ['Critério 1', 2],
    ])
  })

  it('posição inválida ou critério desconhecido recusam', () => {
    expect(() => moveAcceptanceCriterion(aTask(), listOf(2), criterionId(1), 2)).toThrow(
      'Posição do critério inválida',
    )
    expect(() => moveAcceptanceCriterion(aTask(), listOf(2), criterionId(9), 0)).toThrow(
      'Critério não encontrado',
    )
  })

  it('só os critérios cuja posição mudou precisam ser gravados', () => {
    const before = listOf(3)
    const after = moveAcceptanceCriterion(aTask(), before, criterionId(3), 0)
    expect(
      changedAcceptancePositions(before, after)
        .map((c) => c.id)
        .sort(),
    ).toEqual([criterionId(1), criterionId(2), criterionId(3)].sort())
    expect(
      changedAcceptancePositions(
        before,
        moveAcceptanceCriterion(aTask(), before, criterionId(2), 1),
      ),
    ).toEqual([])
  })
})

describe('critérios: tarefa arquivada não edita', () => {
  const archived = aTask({ archivedAt: '2026-01-03T00:00:00.000Z', archivedBy: toUserId(id(2)) })

  it('adicionar, marcar, renomear, remover e mover recusam com conflito', () => {
    const [first, second] = listOf(2)
    if (!first || !second) throw new Error('fixture')
    expect(() =>
      addAcceptanceCriterion(archived, [], { id: criterionId(9), text: 'x', createdAt: at }),
    ).toThrow(ConflictError)
    expect(() => setAcceptanceDone(archived, first, true, at)).toThrow(ConflictError)
    expect(() => renameAcceptanceCriterion(archived, first, 'y', at)).toThrow(ConflictError)
    expect(() => removeAcceptanceCriterion(archived, [first, second], first.id)).toThrow(
      ConflictError,
    )
    expect(() => moveAcceptanceCriterion(archived, [first, second], first.id, 1)).toThrow(
      ConflictError,
    )
  })
})

describe('critérios: eventos da linha do tempo', () => {
  it('cada evento leva o id e o texto do critério', () => {
    expect(
      acceptanceEventDraft('acceptance_criterion_done', criterion(1, 0, { text: 'Abrir' })),
    ).toEqual({
      type: 'acceptance_criterion_done',
      payload: { criterionId: criterionId(1), text: 'Abrir' },
    })
  })
})
