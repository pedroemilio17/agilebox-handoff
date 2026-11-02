import { describe, expect, it } from 'vitest'
import type { Participation } from '../entities/participation'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import type { Actor } from '../policies/actor'
import { ValidationError } from '../shared/errors'
import {
  toContributorId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import { MAX_ESTIMATED_HOURS } from '../values/hours'
import { plannedShareCents, visiblePlannedCost, visibleRealizedCost } from './estimate-cost'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const otherOrg = toOrganizationId(id(9))
const responsibleUser = toUserId(id(1))
const supportUser = toUserId(id(2))
const idleUser = toUserId(id(3))
const outsider = toUserId(id(4))

const manager: Actor = { userId: toUserId(id(5)), organizationId: org, role: 'manager' }
const responsible: Actor = { userId: responsibleUser, organizationId: org, role: 'collaborator' }
const support: Actor = { userId: supportUser, organizationId: org, role: 'collaborator' }
const notInvolved: Actor = { userId: outsider, organizationId: org, role: 'collaborator' }

const participation = (
  n: number,
  participant: Participation['participant'],
  role: Participation['role'],
  hoursHundredths: number,
  rateCents: number,
): Participation => ({
  id: toParticipationId(id(n)),
  taskId: toTaskId(id(1)),
  participant,
  role,
  hoursHundredths,
  rateCents,
  addedAt: '2026-01-01T00:00:00Z',
})

const base = createTask({
  id: toTaskId(id(1)),
  organizationId: org,
  projectId: toProjectId(id(1)),
  projectName: 'Projeto',
  createdBy: responsibleUser,
  title: 'Tarefa',
  createdAt: '2026-01-01T00:00:00Z',
  responsibleParticipationId: toParticipationId(id(10)),
  responsibleRateCents: 4500,
})

/** Responsável com 2 h a R$ 45; apoio com 1 h a R$ 60; entidade sem horas a R$ 100. */
const withTeam = (estimatedHours: number | null): Task => ({
  ...base,
  estimatedHours,
  participations: [
    participation(10, { kind: 'user', userId: responsibleUser }, 'responsible', 200, 4500),
    participation(11, { kind: 'user', userId: supportUser }, 'support', 100, 6000),
    participation(
      12,
      { kind: 'contributor', contributorId: toContributorId(id(7)) },
      'support',
      0,
      10000,
    ),
  ],
})

/** Responsável com 2 h a R$ 45; apoio com `supportHundredths` a R$ 60; estimativa de 3 h. */
const pairOf = (supportHundredths: number): Task => ({
  ...base,
  estimatedHours: 300,
  participations: [
    participation(10, { kind: 'user', userId: responsibleUser }, 'responsible', 200, 4500),
    participation(11, { kind: 'user', userId: supportUser }, 'support', supportHundredths, 6000),
  ],
})

describe('parcela da estimativa', () => {
  it.each([
    [100, 1, 4500, 4500],
    [300, 2, 4500, 6750],
    [100, 3, 4000, 1333],
    [100, 3, 4500, 1500],
    [50, 1, 1, 1],
    [49, 1, 1, 0],
    [0, 4, 4500, 0],
  ])('%i centésimos entre %i pessoas a %i centavos/h = %i centavos', (h, n, r, expected) => {
    expect(plannedShareCents(h, n, r)).toBe(expected)
  })

  it('recusa entradas inválidas e resultado inseguro', () => {
    expect(() => plannedShareCents(-1, 1, 100)).toThrow(ValidationError)
    expect(() => plannedShareCents(1.5, 1, 100)).toThrow(ValidationError)
    expect(() => plannedShareCents(100, 0, 100)).toThrow(ValidationError)
    expect(() => plannedShareCents(100, 1, -1)).toThrow(ValidationError)
    expect(() => plannedShareCents(MAX_ESTIMATED_HOURS, 1, Number.MAX_SAFE_INTEGER)).toThrow(
      ValidationError,
    )
  })
})

describe('custo estimado', () => {
  it('sem estimativa, ninguém recebe valor', () => {
    const task = withTeam(null)
    expect(visiblePlannedCost(manager, task)).toBeNull()
    expect(visiblePlannedCost(responsible, task)).toBeNull()
    expect(visiblePlannedCost(support, task)).toBeNull()
  })

  it('sem envolvidos, recebe nulo (inclusive o gestor)', () => {
    const task: Task = { ...withTeam(300), participations: [] }
    expect(visiblePlannedCost(manager, task)).toBeNull()
  })

  it('gestor vê o total: 3 h divididas em partes iguais entre os 3 envolvidos', () => {
    // 1 h para cada um: R$ 45 + R$ 60 + R$ 100.
    expect(visiblePlannedCost(manager, withTeam(300))).toBe(4500 + 6000 + 10000)
  })

  it('colaborador vê só a própria parcela', () => {
    const task = withTeam(300)
    expect(visiblePlannedCost(responsible, task)).toBe(4500)
    expect(visiblePlannedCost(support, task)).toBe(6000)
  })

  it('a estimativa de quem lança horas não muda: A (2 h a R$ 45) e B (0 h a R$ 60), estimativa 3 h', () => {
    const before = pairOf(0)
    const after = pairOf(100)
    // Divisão igual entre A e B: 1,5 h cada. A: R$ 67,50. B: R$ 90,00.
    expect(visiblePlannedCost(manager, before)).toBe(6750 + 9000)
    expect(visiblePlannedCost(manager, after)).toBe(6750 + 9000)
    expect(visiblePlannedCost(responsible, after)).toBe(6750)
    expect(visiblePlannedCost(support, before)).toBe(9000)
    expect(visiblePlannedCost(support, after)).toBe(9000)
  })

  it('envolvido sem horas realizadas entra na divisão e vê a própria parcela', () => {
    const task = withTeam(300)
    const idle: Task = {
      ...task,
      participations: [
        ...task.participations,
        participation(13, { kind: 'user', userId: idleUser }, 'support', 0, 3000),
      ],
    }
    const idleActor: Actor = { userId: idleUser, organizationId: org, role: 'collaborator' }
    // 3 h divididas entre 4 envolvidos: 0,75 h cada.
    expect(visiblePlannedCost(idleActor, idle)).toBe(2250)
    expect(visiblePlannedCost(responsible, idle)).toBe(3375)
    expect(visiblePlannedCost(manager, idle)).toBe(3375 + 4500 + 7500 + 2250)
  })

  it('o valor/hora de outro envolvido não muda a parcela de quem vê', () => {
    const task = withTeam(300)
    const changed: Task = {
      ...task,
      participations: task.participations.map((p) =>
        p.id === toParticipationId(id(11)) ? { ...p, rateCents: 9999 } : p,
      ),
    }
    expect(visiblePlannedCost(responsible, changed)).toBe(visiblePlannedCost(responsible, task))
  })

  it('quem não participa não recebe o cálculo', () => {
    expect(visiblePlannedCost(notInvolved, withTeam(300))).toBeNull()
  })

  it('sem horas realizadas em ninguém, divide entre todos os envolvidos', () => {
    const task: Task = {
      ...withTeam(300),
      participations: [
        participation(10, { kind: 'user', userId: responsibleUser }, 'responsible', 0, 4500),
        participation(11, { kind: 'user', userId: supportUser }, 'support', 0, 6000),
      ],
    }
    expect(visiblePlannedCost(manager, task)).toBe(6750 + 9000)
  })

  it('arredondamento: 1 h entre 3 pessoas a R$ 40 dá 3999 centavos, a até n/2 do exato (4000)', () => {
    const task: Task = {
      ...withTeam(100),
      participations: [1, 2, 3].map((n) =>
        participation(n, { kind: 'user', userId: toUserId(id(n)) }, 'support', 0, 4000),
      ),
    }
    const total = visiblePlannedCost(manager, task)
    expect(total).toBe(3999)
    expect(Math.abs((total ?? 0) - 4000)).toBeLessThanOrEqual(3 / 2)
  })

  it('outra organização nunca recebe o cálculo', () => {
    expect(visiblePlannedCost({ ...manager, organizationId: otherOrg }, withTeam(300))).toBeNull()
    expect(
      visiblePlannedCost({ ...responsible, organizationId: otherOrg }, withTeam(300)),
    ).toBeNull()
  })

  it('não altera a tarefa de entrada', () => {
    const task = withTeam(300)
    const snapshot = structuredClone(task)
    visiblePlannedCost(manager, task)
    expect(task).toEqual(snapshot)
  })

  it('aguenta time grande: 10 h divididas entre 10 mil envolvidos a R$ 45/h', () => {
    const many: Participation[] = Array.from({ length: 10_000 }, (_, i) =>
      participation(100 + i, { kind: 'user', userId: toUserId(id(100 + i)) }, 'support', 0, 4500),
    )
    // 0,001 h x R$ 45 = 4,5 centavos por pessoa, arredondado para 5: 10 mil x 5 centavos.
    expect(visiblePlannedCost(manager, { ...withTeam(1000), participations: many })).toBe(50_000)
  })
})

describe('custo realizado (horas por participação)', () => {
  it('gestor vê o total de todos', () => {
    expect(visibleRealizedCost(manager, withTeam(300))).toBe(9000 + 6000)
  })

  it('colaborador vê só a própria parte', () => {
    const task = withTeam(300)
    expect(visibleRealizedCost(responsible, task)).toBe(9000)
    expect(visibleRealizedCost(support, task)).toBe(6000)
  })

  it('quem não participa recebe nulo, e outra organização também', () => {
    expect(visibleRealizedCost(notInvolved, withTeam(300))).toBeNull()
    expect(visibleRealizedCost({ ...manager, organizationId: otherOrg }, withTeam(300))).toBeNull()
  })

  it('não depende da estimativa', () => {
    expect(visibleRealizedCost(manager, withTeam(null))).toBe(
      visibleRealizedCost(manager, withTeam(999)),
    )
  })
})
