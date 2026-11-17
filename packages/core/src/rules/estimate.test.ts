import { describe, expect, it } from 'vitest'
import { addParticipant, createTask, setEstimatedHours } from '../entities/task'
import type { Task } from '../entities/task'
import type { Actor } from '../policies/actor'
import { canSeeEstimatedCost } from '../policies/access-policy'
import { ConflictError, ValidationError } from '../shared/errors'
import { toOrganizationId, toParticipationId, toProjectId, toTaskId, toUserId } from '../shared/ids'
import type { OrganizationId, UserId } from '../shared/ids'
import { ESTIMATE_MAX_HOURS, estimateToHundredths, hundredthsToHours } from '../values/hours'
import { estimatedCost, estimatedCostOf, estimateRateCents, spentHundredths } from './cost'

const id = (n: number) => `0000000000000000000000000${n}`
const org = toOrganizationId(id(1))
const otherOrg = toOrganizationId(id(9))
const responsibleId = toUserId(id(2))
const supportId = toUserId(id(3))
const outsiderId = toUserId(id(4))

function actor(
  userId: UserId,
  role: Actor['role'] = 'collaborator',
  organizationId: OrganizationId = org,
): Actor {
  return { userId, organizationId, role }
}

/** Tarefa com Responsável `responsibleId` (valor/hora 4500) e um Apoio com 2 h e 3000. */
function aTask(responsibleRateCents = 4500): Task {
  const base = createTask({
    id: toTaskId(id(1)),
    organizationId: org,
    number: 1,
    projectId: toProjectId(id(1)),
    projectName: 'Projeto',
    createdBy: responsibleId,
    title: 'Tarefa',
    createdAt: '2026-01-01T00:00:00.000Z',
    responsibleParticipationId: toParticipationId(id(2)),
    responsibleRateCents,
  })
  return addParticipant(base, {
    id: toParticipationId(id(3)),
    taskId: base.id,
    participant: { kind: 'user', userId: supportId },
    role: 'support',
    hoursHundredths: 200,
    rateCents: 3000,
    addedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('estimativa em horas: conversão', () => {
  it.each([
    [null, null],
    [0, 0],
    [1.5, 150],
    [1.25, 125],
    [1.1, 110],
    [ESTIMATE_MAX_HOURS, ESTIMATE_MAX_HOURS * 100],
  ])('converte %s em centésimos %s', (hours, expected) => {
    expect(estimateToHundredths(hours)).toBe(expected)
  })

  it.each([-0.01, ESTIMATE_MAX_HOURS + 0.01, 1.005, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejeita %s',
    (hours) => {
      expect(() => estimateToHundredths(hours)).toThrow(ValidationError)
    },
  )

  it('devolve as horas exibidas e mantém nulo', () => {
    expect(hundredthsToHours(250)).toBe(2.5)
    expect(hundredthsToHours(null)).toBeNull()
  })
})

describe('estimativa na tarefa', () => {
  it('define e limpa a estimativa', () => {
    const task = setEstimatedHours(aTask(), 2.5)
    expect(task.estimatedHoursHundredths).toBe(250)
    expect(setEstimatedHours(task, null).estimatedHoursHundredths).toBeNull()
  })

  it('valor igual devolve a mesma tarefa (sem alteração na linha do tempo)', () => {
    const task = setEstimatedHours(aTask(), 2.5)
    expect(setEstimatedHours(task, 2.5)).toBe(task)
  })

  it('tarefa arquivada não muda a estimativa', () => {
    const archived = {
      ...aTask(),
      archivedAt: '2026-01-02T00:00:00.000Z',
      archivedBy: responsibleId,
    }
    expect(() => setEstimatedHours(archived, 1)).toThrow(ConflictError)
  })

  it('a estimativa começa nula em tarefa nova', () => {
    expect(aTask().estimatedHoursHundredths).toBeNull()
  })
})

describe('custo estimado', () => {
  it('sem estimativa, ou sem valor/hora, não há custo', () => {
    expect(estimatedCost(null, 4500)).toBeNull()
    expect(estimatedCost(250, 0)).toBeNull()
  })

  it('estimativa zero custa zero, e não é "sem custo"', () => {
    expect(estimatedCost(0, 4500)).toBe(0)
  })

  it('usa o mesmo arredondamento do custo realizado (meio para cima)', () => {
    expect(estimatedCost(1, 50)).toBe(1)
    expect(estimatedCost(250, 4500)).toBe(11250)
  })

  it('valor/hora do Responsável; sem valor, o padrão do usuário', () => {
    expect(estimateRateCents(4500, 6000)).toBe(4500)
    expect(estimateRateCents(0, 6000)).toBe(6000)
    expect(estimateRateCents(0, 0)).toBe(0)
  })

  it('custo estimado da tarefa segue o Responsável, não o Apoio', () => {
    expect(estimatedCostOf({ ...aTask(), estimatedHoursHundredths: 250 }, 9999)).toBe(11250)
  })

  it('usa o padrão do Responsável quando o envolvimento dele está sem valor', () => {
    const task = { ...aTask(0), estimatedHoursHundredths: 250 }
    expect(estimatedCostOf(task, 6000)).toBe(15000)
  })

  it('sem valor em lugar nenhum, o custo estimado é nulo', () => {
    const task = { ...aTask(0), estimatedHoursHundredths: 250 }
    expect(estimatedCostOf(task, 0)).toBeNull()
  })

  it('soma as horas realizadas das participações', () => {
    expect(spentHundredths(aTask().participations)).toBe(200)
  })
})

describe('visibilidade do custo estimado', () => {
  const task = { ...aTask(), estimatedHoursHundredths: 250 }

  it('o gestor da organização vê', () => {
    expect(canSeeEstimatedCost(actor(outsiderId, 'manager'), task)).toBe(true)
  })

  it('o Responsável vê o custo da própria tarefa', () => {
    expect(canSeeEstimatedCost(actor(responsibleId), task)).toBe(true)
  })

  it('quem é só Apoio não vê o custo estimado (vê o valor/hora só do próprio envolvimento)', () => {
    expect(canSeeEstimatedCost(actor(supportId), task)).toBe(false)
  })

  it('colaborador de fora não vê', () => {
    expect(canSeeEstimatedCost(actor(outsiderId), task)).toBe(false)
  })

  it('gestor de outra organização não vê', () => {
    expect(canSeeEstimatedCost(actor(outsiderId, 'manager', otherOrg), task)).toBe(false)
  })

  it('segue a troca de Responsável', () => {
    const shifted = {
      ...task,
      participations: task.participations.map((p) => ({
        ...p,
        role:
          p.participant.kind === 'user' && p.participant.userId === supportId
            ? ('responsible' as const)
            : ('support' as const),
      })),
    }
    expect(canSeeEstimatedCost(actor(supportId), shifted)).toBe(true)
    expect(canSeeEstimatedCost(actor(responsibleId), shifted)).toBe(false)
  })
})
