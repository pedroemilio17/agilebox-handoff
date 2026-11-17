import { describe, expect, it } from 'vitest'
import { createSprint } from '../entities/sprint'
import type { Sprint, SprintStatus } from '../entities/sprint'
import { ConflictError, ValidationError } from '../shared/errors'
import { toOrganizationId, toProjectId, toSprintId, toUserId } from '../shared/ids'
import {
  assertSprintTransition,
  canStartSprint,
  canTransitionSprint,
  endSprint,
  nextSprintNumber,
  readSprintsMaxActive,
  SPRINTS_MAX_ACTIVE_DEFAULT,
  startSprint,
  updateSprint,
} from './sprint-lifecycle'

const id = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-02T09:00:00.000Z'
const later = '2026-03-13T18:00:00.000Z'

function aDraft(number = 4): Sprint {
  return createSprint({
    id: toSprintId(id(number)),
    organizationId: toOrganizationId(id(1)),
    projectId: toProjectId(id(1)),
    number,
    name: '',
    goal: null,
    plannedStart: '2026-03-02',
    plannedEnd: '2026-03-13',
    createdBy: toUserId(id(1)),
    createdAt: '2026-03-01T10:00:00.000Z',
  })
}

function anActive(number = 4): Sprint {
  return startSprint(aDraft(number), at, 0, 1)
}

describe('transições da sprint', () => {
  const statuses: SprintStatus[] = ['draft', 'active', 'closed']
  const valid: [SprintStatus, SprintStatus][] = [
    ['draft', 'active'],
    ['active', 'closed'],
  ]

  it('só draft→active e active→closed são válidas (todas as demais são recusadas)', () => {
    for (const from of statuses) {
      for (const to of statuses) {
        const expected = valid.some(([a, b]) => a === from && b === to)
        expect(canTransitionSprint(from, to)).toBe(expected)
        if (expected) expect(() => assertSprintTransition(from, to)).not.toThrow()
        else expect(() => assertSprintTransition(from, to)).toThrow(ConflictError)
      }
    }
  })

  it('mensagens de transição inválida são em pt-BR', () => {
    expect(() => assertSprintTransition('draft', 'closed')).toThrow(
      'Sprint rascunho não pode passar para encerrada',
    )
    expect(() => assertSprintTransition('closed', 'active')).toThrow(
      'Sprint encerrada é só para leitura',
    )
  })

  it('encerrar um rascunho é recusado; iniciar uma sprint ativa também', () => {
    expect(() => endSprint(aDraft(), later, { kind: 'return_to_backlog' })).toThrow(ConflictError)
    expect(() => startSprint(anActive(), later, 0, 1)).toThrow(ConflictError)
  })
})

describe('limite de sprints ativas', () => {
  it('canStartSprint com limite 1: vaga só com zero ativas', () => {
    expect(canStartSprint(0, 1)).toBe(true)
    expect(canStartSprint(1, 1)).toBe(false)
  })

  it('canStartSprint com limite 2: vaga com 0 e com 1 ativa; recusa com 2', () => {
    expect(canStartSprint(0, 2)).toBe(true)
    expect(canStartSprint(1, 2)).toBe(true)
    expect(canStartSprint(2, 2)).toBe(false)
  })

  it('canStartSprint recusa entradas inválidas', () => {
    expect(() => canStartSprint(-1, 1)).toThrow(ValidationError)
    expect(() => canStartSprint(0, 0)).toThrow(ValidationError)
    expect(() => canStartSprint(0.5, 1)).toThrow(ValidationError)
  })

  it('iniciar além do limite 1 é CONFLITO com mensagem clara', () => {
    expect(() => startSprint(aDraft(5), at, 1, 1)).toThrow(ConflictError)
    expect(() => startSprint(aDraft(5), at, 1, 1)).toThrow(
      'Já existe uma sprint ativa neste projeto. Encerre-a antes de iniciar outra',
    )
  })

  it('com limite 2, a segunda sprint inicia e a terceira é recusada com a mensagem do limite', () => {
    expect(startSprint(aDraft(5), at, 1, 2).status).toBe('active')
    expect(() => startSprint(aDraft(6), at, 2, 2)).toThrow(
      'Este projeto já tem 2 sprints ativas, o limite configurado. Encerre uma antes de iniciar outra',
    )
  })

  it('readSprintsMaxActive: ausente usa o padrão 1 (ADR-08); configurado vale; inválido é recusado', () => {
    expect(SPRINTS_MAX_ACTIVE_DEFAULT).toBe(1)
    expect(readSprintsMaxActive(undefined)).toBe(1)
    expect(readSprintsMaxActive({})).toBe(1)
    expect(readSprintsMaxActive({ maxActiveSprints: 3 })).toBe(3)
    for (const bad of [0, -2, 1.5, '2', null, true]) {
      expect(() => readSprintsMaxActive({ maxActiveSprints: bad as never })).toThrow(
        'Limite de sprints ativas deve ser um número inteiro de 1 ou mais',
      )
    }
  })
})

describe('iniciar e encerrar', () => {
  it('iniciar grava o instante e muda para ativa; encerrar grava instante e política', () => {
    const active = startSprint(aDraft(), at, 0, 1)
    expect(active).toMatchObject({ status: 'active', startedAt: at, closedAt: null })
    const closed = endSprint(active, later, { kind: 'return_to_backlog' })
    expect(closed).toMatchObject({
      status: 'closed',
      closedAt: later,
      closePolicy: { kind: 'return_to_backlog' },
    })
  })
})

describe('editar sprint', () => {
  it('rascunho e ativa editam nome, meta e datas', () => {
    const draft = updateSprint(aDraft(), {
      name: 'Login',
      goal: 'Entregar login',
      plannedEnd: '2026-03-20',
    })
    expect(draft).toMatchObject({ name: 'Login', goal: 'Entregar login', plannedEnd: '2026-03-20' })
    const active = updateSprint(anActive(), { name: 'Login v2', goal: null })
    expect(active).toMatchObject({ name: 'Login v2', goal: null, status: 'active' })
  })

  it('edição sem mudança devolve a mesma sprint', () => {
    const draft = aDraft()
    expect(updateSprint(draft, {})).toBe(draft)
    expect(updateSprint(draft, { name: 'Sprint 4' })).toBe(draft)
  })

  it('datas inválidas na edição são recusadas', () => {
    expect(() => updateSprint(aDraft(), { plannedStart: '2026-04-01' })).toThrow(
      'A data de início não pode ser depois da data de fim',
    )
  })

  it('encerrada é imutável: nenhuma edição passa', () => {
    const closed = endSprint(anActive(), later, { kind: 'return_to_backlog' })
    expect(() => updateSprint(closed, { name: 'Outro' })).toThrow(
      'Sprint encerrada é só para leitura',
    )
    expect(() => updateSprint(closed, {})).toThrow(ConflictError)
  })
})

describe('numeração sequencial por projeto', () => {
  it('começa em 1 e segue o maior número existente', () => {
    expect(nextSprintNumber([])).toBe(1)
    expect(nextSprintNumber([{ number: 1 }, { number: 2 }, { number: 3 }])).toBe(4)
  })

  it('não reaproveita número quando há lacunas, pelo maior existente', () => {
    expect(nextSprintNumber([{ number: 2 }, { number: 7 }])).toBe(8)
  })
})
