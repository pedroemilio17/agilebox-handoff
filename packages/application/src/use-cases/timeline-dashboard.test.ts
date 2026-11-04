import { describe, expect, it } from 'vitest'
import {
  parseDateOnly,
  createUser,
  createTimelineEvent,
  toEventId,
  toOrganizationId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aTask, aUser } from '../testing/builders'
import { FixedClock } from '../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../testing/fakes/sequential-id-generator'
import { createUseCases } from '../create-use-cases'
import type { ActorSession } from '../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork }
}

describe('linha do tempo e dashboard', () => {
  it('entrega sinais, fluxo semanal, mudanças e equipe com dados reais da organização', async () => {
    const { useCases, unitOfWork } = setup()
    const task = {
      ...aTask().build(),
      status: 'review' as const,
      createdAt: '2025-12-20T12:00:00Z',
      updatedAt: '2026-01-01T12:00:00Z',
      deadline: parseDateOnly('2025-12-30'),
    }
    const done = { ...task, id: toTaskId('00000000000000000000000026'), status: 'done' as const }
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.tasks.save(organizationId, done)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    const event = {
      id: toEventId('00000000000000000000000027'),
      taskId: done.id,
      actorUserId: userId,
      asManager: false,
      at: '2025-12-29T12:00:00Z',
      type: 'status_changed' as const,
      payload: { before: 'todo' as const, after: 'in_progress' as const },
    }
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event,
      {
        ...event,
        id: toEventId('00000000000000000000000028'),
        at: '2026-01-01T12:00:00Z',
        payload: { before: 'in_progress', after: 'done' },
      },
    ])
    const result = await useCases.dashboard.get.execute(manager)
    expect(result.insights).toMatchObject({
      agingCount: 1,
      overdueCount: 1,
      throughput: 1,
      cycleDays: 3,
      leadDays: 12,
      upToDatePercentage: 100,
      weekStart: '2025-12-29',
    })
    expect(result.insights?.weeks).toHaveLength(6)
    expect(result.insights?.weeks[5]?.throughput).toBe(1)
    expect(result.insights?.recentChanges).toHaveLength(1)
    expect(result.insights?.recentChanges[0]?.text).toContain('para Concluído')
    expect(result.insights?.team[0]).toMatchObject({
      inProgress: 1,
      agingCount: 1,
      overdueCount: 1,
      lastUpdatedAt: '2026-01-01T12:00:00Z',
    })
  })

  it('conta bloqueadas e não as trata como paradas no alerta do gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const task = {
      ...aTask().build(),
      status: 'in_progress' as const,
      createdAt: '2025-12-20T12:00:00Z',
      updatedAt: '2025-12-20T12:00:00Z',
      blockedReason: 'Aguardando credenciais',
      blockedAt: '2025-12-20T12:00:00Z',
    }
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    const result = await useCases.dashboard.get.execute(manager)
    expect(result.insights).toMatchObject({ blockedCount: 1, agingCount: 0 })
    expect(result.insights?.team[0]).toMatchObject({ blockedCount: 1, agingCount: 0 })
  })

  it('lista a linha do tempo mais recente primeiro e gera o texto para o viewer', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const older = createTimelineEvent({
      id: toEventId('00000000000000000000000020'),
      taskId: task.id,
      at: '2026-01-01T10:00:00.000Z',
      actorUserId: userId,
      asManager: false,
      type: 'renamed',
      payload: { before: 'Antes', after: 'Depois' },
    })
    const newer = createTimelineEvent({
      id: toEventId('00000000000000000000000021'),
      taskId: task.id,
      at: '2026-01-01T11:00:00.000Z',
      actorUserId: userId,
      asManager: false,
      type: 'task_created',
      payload: {},
    })
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    await unitOfWork.repositories.timeline.saveMany(organizationId, [older, newer])

    await expect(useCases.timeline.list.execute(actor, { taskId: task.id })).resolves.toMatchObject(
      [
        { id: newer.id, text: 'criou a tarefa' },
        { id: older.id, text: 'renomeou de Antes para Depois' },
      ],
    )
  })

  it('permite consultar a linha do tempo só quando o ator pode ver a tarefa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const task = aTask().inProject(project).build()
    const inaccessible = {
      ...task,
      id: toTaskId('00000000000000000000000022'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.tasks.save(organizationId, inaccessible)

    await expect(useCases.timeline.list.execute(actor, { taskId: task.id })).resolves.toEqual([])
    await expect(
      useCases.timeline.list.execute(actor, { taskId: inaccessible.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.timeline.list.execute(manager, { taskId: inaccessible.id }),
    ).resolves.toEqual([])
  })

  it('mostra valores de tarifa apenas para quem pode vê-los na descrição do evento', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const event = createTimelineEvent({
      id: toEventId('00000000000000000000000023'),
      taskId: task.id,
      at: '2026-01-01T10:00:00.000Z',
      actorUserId: userId,
      asManager: false,
      type: 'rate_changed',
      payload: { participant: { kind: 'user', userId: otherUserId }, before: 4000, after: 4500 },
    })
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    await unitOfWork.repositories.users.save(
      organizationId,
      aUser().with({ id: otherUserId, name: 'Bruno' }).build(),
    )
    await unitOfWork.repositories.timeline.saveMany(organizationId, [event])

    await expect(useCases.timeline.list.execute(actor, { taskId: task.id })).resolves.toMatchObject(
      [{ text: 'alterou o valor/hora de Bruno' }],
    )
    await expect(
      useCases.timeline.list.execute(manager, { taskId: task.id }),
    ).resolves.toMatchObject([{ text: 'alterou o valor/hora de Bruno de R$ 40,00 para R$ 45,00' }])
  })

  it('restringe o dashboard ao gestor e calcula totais e estatísticas por participação', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = aTask().inProject(project).build()
    const other = {
      ...mine,
      id: toTaskId('00000000000000000000000024'),
      createdBy: otherUserId,
      status: 'done' as const,
      participations: [],
    }
    const managerTask = {
      ...mine,
      id: toTaskId('00000000000000000000000025'),
      createdBy: managerId,
      status: 'todo' as const,
      participations: [],
    }
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    await unitOfWork.repositories.users.save(
      organizationId,
      aUser().with({ id: otherUserId, name: 'Bruno' }).build(),
    )
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        ...aUser().with({ id: managerId, name: 'Gestor' }).build(),
        role: 'manager',
      }),
    )
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, other)
    await unitOfWork.repositories.tasks.save(organizationId, managerTask)

    await expect(useCases.dashboard.get.execute(actor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(useCases.dashboard.get.execute(manager)).resolves.toMatchObject({
      distribution: { planning: 34, todo: 33, in_progress: 0, review: 0, done: 33 },
      collaborators: [
        { user: { id: userId }, taskCount: 1 },
        { user: { id: otherUserId }, taskCount: 1, completedPercentage: 100 },
        { user: { id: managerId }, taskCount: 1 },
      ],
    })
  })
})
