import { describe, expect, it } from 'vitest'
import { createTask } from '../entities/task'
import type { Task } from '../entities/task'
import { createParticipation } from '../entities/participation'
import { openImpediment } from '../entities/impediment'
import { canResolveImpediment, canSeeImpediment } from '../policies/access-policy'
import type { Actor } from '../policies/actor'
import { ConflictError, ValidationError } from '../shared/errors'
import {
  toImpedimentId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import {
  assertImpedimentOwnerEligible,
  canBeImpedimentOwner,
  planImpedimentSync,
} from './impediments'
import type { ImpedimentOwnerCandidate } from './impediments'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(9))
const otherOrg = toOrganizationId(id(8))
const creator = toUserId(id(1))
const support = toUserId(id(2))
const outsider = toUserId(id(4))
const manager = toUserId(id(5))
const at = '2026-01-02T10:00:00.000Z'
const later = '2026-01-03T10:00:00.000Z'

function aTask(overrides: Partial<Task> = {}): Task {
  const base = createTask({
    id: toTaskId(id(3)),
    organizationId: org,
    number: 1,
    projectId: toProjectId(id(6)),
    projectName: 'P',
    createdBy: creator,
    title: 'Tarefa',
    createdAt: at,
    responsibleParticipationId: toParticipationId(id(10)),
    responsibleRateCents: 0,
  })
  const withSupport = {
    ...base,
    participations: [
      ...base.participations,
      createParticipation({
        id: toParticipationId(id(11)),
        taskId: base.id,
        participant: { kind: 'user', userId: support },
        role: 'support',
        hoursHundredths: 0,
        rateCents: 0,
        addedAt: at,
      }),
    ],
  }
  return { ...withSupport, ...overrides }
}

const blockedTask = (reason = 'Aguardando credenciais') =>
  aTask({ blockedReason: reason, blockedAt: at, status: 'in_progress' })
const unblocked = (task: Task) => ({ ...task, blockedReason: null, blockedAt: null })
const candidate = (
  userId: typeof creator,
  role: 'collaborator' | 'manager' = 'collaborator',
): ImpedimentOwnerCandidate => ({
  userId,
  organizationId: org,
  role,
})
const newId = toImpedimentId(id(7))

describe('elegibilidade do responsável', () => {
  it('aceita quem participa (criador, Responsável ou Apoio) e o gestor', () => {
    const task = aTask()
    expect(canBeImpedimentOwner(task, candidate(creator))).toBe(true)
    expect(canBeImpedimentOwner(task, candidate(support))).toBe(true)
    expect(canBeImpedimentOwner(task, candidate(manager, 'manager'))).toBe(true)
  })

  it('recusa quem não participa e quem é de outra organização', () => {
    const task = aTask()
    expect(canBeImpedimentOwner(task, candidate(outsider))).toBe(false)
    expect(
      canBeImpedimentOwner(task, { ...candidate(manager, 'manager'), organizationId: otherOrg }),
    ).toBe(false)
    expect(() => assertImpedimentOwnerEligible(task, candidate(outsider))).toThrow(ValidationError)
  })
})

describe('planejador de sincronia do impedimento', () => {
  it('bloquear abre o impedimento com o responsável e registra a atribuição', () => {
    const task = aTask()
    const after = blockedTask()
    const plan = planImpedimentSync({
      after,
      open: null,
      newId,
      actor: creator,
      at,
      owner: candidate(support),
      resolution: null,
    })
    expect(plan.saves).toEqual([
      expect.objectContaining({
        id: newId,
        status: 'open',
        ownerId: support,
        openedBy: creator,
        reason: 'Aguardando credenciais',
      }),
    ])
    expect(plan.drafts).toEqual([
      {
        type: 'impediment_assigned',
        payload: { impedimentId: newId, before: null, after: support },
      },
    ])
    expect(task.blockedReason).toBeNull()
  })

  it('bloquear sem responsável abre sem atribuição na linha do tempo', () => {
    const plan = planImpedimentSync({
      after: blockedTask(),
      open: null,
      newId,
      actor: creator,
      at,
      resolution: null,
    })
    expect(plan.saves[0]?.ownerId).toBeNull()
    expect(plan.drafts).toEqual([])
  })

  it('bloquear exige id novo e recusa responsável que não participa', () => {
    expect(() =>
      planImpedimentSync({
        after: blockedTask(),
        open: null,
        newId: null,
        actor: creator,
        at,
        resolution: null,
      }),
    ).toThrow(Error)
    expect(() =>
      planImpedimentSync({
        after: blockedTask(),
        open: null,
        newId,
        actor: creator,
        at,
        owner: candidate(outsider),
        resolution: null,
      }),
    ).toThrow(ValidationError)
  })

  it('bloquear de novo com outro motivo atualiza o aberto, sem segundo impedimento', () => {
    const open = openImpediment({
      id: newId,
      organizationId: org,
      taskId: toTaskId(id(3)),
      reason: 'Antigo',
      ownerId: null,
      openedBy: creator,
      openedAt: at,
    })
    const plan = planImpedimentSync({
      after: blockedTask('Novo'),
      open,
      newId: null,
      actor: creator,
      at,
      resolution: null,
    })
    expect(plan.saves).toEqual([
      expect.objectContaining({ id: newId, reason: 'Novo', status: 'open' }),
    ])
  })

  it('trocar responsável no aberto grava e registra o antes e o depois', () => {
    const open = openImpediment({
      id: newId,
      organizationId: org,
      taskId: toTaskId(id(3)),
      reason: 'Motivo',
      ownerId: support,
      openedBy: creator,
      openedAt: at,
    })
    const plan = planImpedimentSync({
      after: blockedTask('Motivo'),
      open,
      newId: null,
      actor: creator,
      at: later,
      owner: candidate(creator),
      resolution: null,
    })
    expect(plan.saves[0]?.ownerId).toBe(creator)
    expect(plan.drafts).toEqual([
      {
        type: 'impediment_assigned',
        payload: { impedimentId: newId, before: support, after: creator },
      },
    ])
  })

  it('limpar o responsável registra a remoção; o mesmo responsável não gera nada', () => {
    const open = openImpediment({
      id: newId,
      organizationId: org,
      taskId: toTaskId(id(3)),
      reason: 'Motivo',
      ownerId: support,
      openedBy: creator,
      openedAt: at,
    })
    const cleared = planImpedimentSync({
      after: blockedTask('Motivo'),
      open,
      newId: null,
      actor: creator,
      at,
      owner: null,
      resolution: null,
    })
    expect(cleared.drafts).toEqual([
      {
        type: 'impediment_assigned',
        payload: { impedimentId: newId, before: support, after: null },
      },
    ])
    const same = planImpedimentSync({
      after: blockedTask('Motivo'),
      open,
      newId: null,
      actor: creator,
      at,
      owner: candidate(support),
      resolution: null,
    })
    expect(same.saves).toEqual([])
    expect(same.drafts).toEqual([])
  })

  it('desbloquear resolve o aberto com a nota, por quem desbloqueia', () => {
    const open = openImpediment({
      id: newId,
      organizationId: org,
      taskId: toTaskId(id(3)),
      reason: 'Motivo',
      ownerId: support,
      openedBy: creator,
      openedAt: at,
    })
    const plan = planImpedimentSync({
      after: unblocked(blockedTask()),
      open,
      newId: null,
      actor: manager,
      at: later,
      resolution: 'Liberado',
    })
    expect(plan.saves).toEqual([
      expect.objectContaining({
        status: 'resolved',
        resolvedBy: manager,
        resolvedAt: later,
        resolution: 'Liberado',
      }),
    ])
  })

  it('tarefa sem bloqueio e sem aberto não muda nada; atribuir sem aberto é recusado', () => {
    const plan = planImpedimentSync({
      after: aTask(),
      open: null,
      newId: null,
      actor: creator,
      at,
      resolution: null,
    })
    expect(plan).toEqual({ saves: [], drafts: [] })
    expect(() =>
      planImpedimentSync({
        after: aTask(),
        open: null,
        newId: null,
        actor: creator,
        at,
        owner: candidate(support),
        resolution: null,
      }),
    ).toThrow(ConflictError)
  })
})

describe('acesso ao impedimento', () => {
  const actor = (
    userId: typeof creator,
    role: 'collaborator' | 'manager' = 'collaborator',
    organizationId = org,
  ): Actor => ({ userId, organizationId, role })
  const open = openImpediment({
    id: newId,
    organizationId: org,
    taskId: toTaskId(id(3)),
    reason: 'Motivo',
    ownerId: outsider,
    openedBy: creator,
    openedAt: at,
  })

  it('vê quem participa e o gestor da organização; não vê quem só é de fora ou de outra organização', () => {
    const task = blockedTask()
    expect(canSeeImpediment(actor(creator), task)).toBe(true)
    expect(canSeeImpediment(actor(support), task)).toBe(true)
    expect(canSeeImpediment(actor(manager, 'manager'), task)).toBe(true)
    expect(canSeeImpediment(actor(outsider), task)).toBe(false)
    expect(canSeeImpediment(actor(manager, 'manager', otherOrg), task)).toBe(false)
  })

  it('resolve quem edita a tarefa ou o próprio responsável, mesmo sem participar', () => {
    const task = blockedTask()
    expect(canResolveImpediment(actor(creator), task, open)).toBe(true)
    expect(canResolveImpediment(actor(outsider), task, open)).toBe(true)
    expect(canResolveImpediment(actor(manager, 'manager'), task, open)).toBe(true)
    expect(canResolveImpediment(actor(support), task, open)).toBe(true)
    expect(canResolveImpediment(actor(toUserId(id(6))), task, open)).toBe(false)
    expect(canResolveImpediment(actor(outsider, 'collaborator', otherOrg), task, open)).toBe(false)
  })

  it('tarefa arquivada não altera impedimento, nem pelo responsável', () => {
    const archived = { ...blockedTask(), archivedAt: at, archivedBy: creator }
    expect(canResolveImpediment(actor(outsider), archived, open)).toBe(false)
    expect(canResolveImpediment(actor(creator), archived, open)).toBe(false)
  })
})
