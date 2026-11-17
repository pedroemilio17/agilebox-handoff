import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toProjectId, toSprintId, toUserId } from '../shared/ids'
import {
  createSprint,
  SPRINT_GOAL_MAX_LENGTH,
  SPRINT_NAME_MAX_LENGTH,
  sprintLabel,
  validateSprintDates,
} from './sprint'
import type { CreateSprintInput } from './sprint'

const id = (n: number) => String(n).padStart(26, '0')
const at = '2026-03-01T10:00:00.000Z'

function input(overrides: Partial<CreateSprintInput> = {}): CreateSprintInput {
  return {
    id: toSprintId(id(1)),
    organizationId: toOrganizationId(id(1)),
    projectId: toProjectId(id(1)),
    number: 4,
    name: 'Sprint de login',
    goal: null,
    plannedStart: '2026-03-02',
    plannedEnd: '2026-03-13',
    createdBy: toUserId(id(1)),
    createdAt: at,
    ...overrides,
  }
}

describe('criar sprint', () => {
  it('nasce em rascunho, sem início, sem encerramento e sem política', () => {
    const sprint = createSprint(input())
    expect(sprint).toMatchObject({
      number: 4,
      name: 'Sprint de login',
      goal: null,
      status: 'draft',
      startedAt: null,
      closedAt: null,
      closePolicy: null,
      plannedStart: '2026-03-02',
      plannedEnd: '2026-03-13',
    })
  })

  it('nome vazio vira "Sprint N"', () => {
    expect(createSprint(input({ name: '   ' })).name).toBe('Sprint 4')
  })

  it('aceita nome de até 80 caracteres e recusa 81', () => {
    expect(createSprint(input({ name: 'a'.repeat(SPRINT_NAME_MAX_LENGTH) })).name).toHaveLength(80)
    expect(() => createSprint(input({ name: 'a'.repeat(SPRINT_NAME_MAX_LENGTH + 1) }))).toThrow(
      ValidationError,
    )
  })

  it('meta é opcional, vazia vira nula, e aceita até 280 caracteres', () => {
    expect(createSprint(input({ goal: '  ' })).goal).toBeNull()
    expect(createSprint(input({ goal: ' Entregar o login ' })).goal).toBe('Entregar o login')
    expect(createSprint(input({ goal: 'x'.repeat(SPRINT_GOAL_MAX_LENGTH) })).goal).toHaveLength(280)
    expect(() => createSprint(input({ goal: 'x'.repeat(SPRINT_GOAL_MAX_LENGTH + 1) }))).toThrow(
      'Meta da sprint deve ter até 280 caracteres',
    )
  })

  it('recusa número inválido (zero, negativo, fracionado)', () => {
    for (const number of [0, -1, 1.5, Number.NaN]) {
      expect(() => createSprint(input({ number }))).toThrow('Número da sprint inválido')
    }
  })

  it('datas: início igual ao fim vale; início depois do fim, formato ruim e data inexistente são recusados', () => {
    expect(validateSprintDates('2026-03-02', '2026-03-02')).toEqual({
      plannedStart: '2026-03-02',
      plannedEnd: '2026-03-02',
    })
    expect(() => validateSprintDates('2026-03-10', '2026-03-02')).toThrow(
      'A data de início não pode ser depois da data de fim',
    )
    expect(() => validateSprintDates('02/03/2026', '2026-03-10')).toThrow('Data inválida')
    expect(() => validateSprintDates('2026-02-30', '2026-03-10')).toThrow('Data inválida')
    expect(() => createSprint(input({ plannedEnd: '2026-13-01' }))).toThrow('Data inválida')
  })
})

describe('rótulo da sprint', () => {
  it('sprintLabel devolve "Sprint N" para o card', () => {
    expect(sprintLabel(4)).toBe('Sprint 4')
    expect(sprintLabel(12)).toBe('Sprint 12')
  })
})
