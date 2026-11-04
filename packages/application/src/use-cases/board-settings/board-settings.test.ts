import { describe, expect, it } from 'vitest'
import {
  toOrganizationId,
  toTaskId,
  toUserId,
  createUser,
  PermissionDeniedError,
} from '@agilebox/core'
import type { Actor, Task, UserId } from '@agilebox/core'
import { aProject, aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const collaborator: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const otherManager: Actor = {
  userId: managerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

function depsFor(unitOfWork: InMemoryUnitOfWork, actor: Actor) {
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  return {
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-20T12:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    retroActions: unitOfWork.repositories.retroActions,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    comments: unitOfWork.repositories.comments,
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
  }
}

/** Casos de uso visto por `actor`, sobre o mesmo estado em memória. */
function useCasesAs(unitOfWork: InMemoryUnitOfWork, actor: Actor) {
  return createUseCases(depsFor(unitOfWork, actor))
}

/** Tarefa com status dado; `participant` decide quem a vê (sem envolvimento, só o criador vê). */
function taskFor(id: number, owner: UserId, status: Task['status'], involved = true): Task {
  const base = aTask()
    .with({
      id: toTaskId(String(id).padStart(26, '0')),
      number: id,
      createdBy: owner,
    })
    .build()
  return { ...base, status, participations: involved ? base.participations : [] }
}

async function seedUsers(unitOfWork: InMemoryUnitOfWork) {
  const users = [
    createUser({
      id: userId,
      organizationId,
      name: 'Ana',
      email: 'ana@x.dev',
      role: 'collaborator',
      defaultRateCents: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    createUser({
      id: otherUserId,
      organizationId,
      name: 'Bruno',
      email: 'bruno@x.dev',
      role: 'collaborator',
      defaultRateCents: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    createUser({
      id: managerId,
      organizationId,
      name: 'Gestor',
      email: 'gestor@x.dev',
      role: 'manager',
      defaultRateCents: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  ]
  for (const user of users) await unitOfWork.repositories.users.save(organizationId, user)
  const project = aProject().build()
  await unitOfWork.repositories.projects.save(organizationId, project)
  return project
}

describe('limites de WIP: casos de uso', () => {
  it('sem registro, o quadro e a configuração vêm sem limites', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    await seedUsers(unitOfWork)

    await expect(useCases.boardSettings.get.execute(manager)).resolves.toEqual({
      wipLimits: {},
      updatedAt: null,
      updatedBy: null,
    })
    const board = await useCases.tasks.listBoard.execute(manager, {})
    expect(board.wipLimits).toEqual({})
    expect(board.wipColumns).toEqual([
      { status: 'in_progress', count: 0, limit: null, state: 'none' },
      { status: 'review', count: 0, limit: null, state: 'none' },
    ])
  })

  it('o gestor define os limites; todo usuário da organização os lê', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    await seedUsers(unitOfWork)

    await useCases.boardSettings.setWipLimits.execute(manager, {
      wipLimits: { in_progress: 3, review: 2 },
    })

    const read = await useCases.boardSettings.get.execute(collaborator)
    expect(read).toMatchObject({
      wipLimits: { in_progress: 3, review: 2 },
      updatedBy: managerId,
    })
    expect(read.updatedAt).toBe('2026-01-20T12:00:00.000Z')
  })

  it('colaborador não altera os limites (FORBIDDEN) e nada muda', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    await seedUsers(unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(manager, { wipLimits: { review: 2 } })

    const asCollaborator = useCasesAs(unitOfWork, collaborator)
    await expect(
      asCollaborator.boardSettings.setWipLimits.execute(collaborator, {
        wipLimits: { review: 9 },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(useCases.boardSettings.get.execute(manager)).resolves.toMatchObject({
      wipLimits: { review: 2 },
    })
  })

  it('rejeita limite 0, 100 e estado que não é de WIP, sem gravar nada', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    await seedUsers(unitOfWork)

    for (const wipLimits of [
      { in_progress: 0 },
      { review: 100 },
      { planning: 3 },
      { done: 1 },
    ] as const) {
      await expect(
        useCases.boardSettings.setWipLimits.execute(manager, { wipLimits }),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
      })
    }
    await expect(useCases.boardSettings.get.execute(manager)).resolves.toMatchObject({
      wipLimits: {},
    })
  })

  it('o limite é sinal, não bloqueio: mover acima do limite continua permitido', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    const project = await seedUsers(unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(manager, {
      wipLimits: { in_progress: 1 },
    })
    const first = taskFor(1, userId, 'todo')
    const second = taskFor(2, userId, 'todo')
    for (const task of [first, second])
      await unitOfWork.repositories.tasks.save(organizationId, { ...task, projectId: project.id })

    const asAna: Actor = collaborator
    const planner = useCasesAs(unitOfWork, asAna)
    await planner.tasks.move.execute(asAna, { taskId: first.id, status: 'in_progress' })
    await expect(
      planner.tasks.move.execute(asAna, { taskId: second.id, status: 'in_progress' }),
    ).resolves.toMatchObject({ status: 'in_progress' })

    const board = await planner.tasks.listBoard.execute(asAna, {})
    expect(board.wipColumns[0]).toEqual({
      status: 'in_progress',
      count: 2,
      limit: 1,
      state: 'over',
    })
  })

  it('o colaborador conta só as tarefas de que participa; o gestor conta todas', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    const project = await seedUsers(unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(manager, {
      wipLimits: { in_progress: 2 },
    })
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...taskFor(1, userId, 'in_progress'),
      projectId: project.id,
    })
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...taskFor(2, otherUserId, 'in_progress', false),
      projectId: project.id,
    })

    const asAna = useCasesAs(unitOfWork, collaborator)
    const mine = await asAna.tasks.listBoard.execute(collaborator, {})
    expect(mine.wipColumns[0]).toMatchObject({ count: 1, limit: 2, state: 'ok' })

    const all = await useCases.tasks.listBoard.execute(manager, {})
    expect(all.wipColumns[0]).toMatchObject({ count: 2, limit: 2, state: 'at_limit' })
  })

  it('a configuração de uma organização não aparece na outra', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    await seedUsers(unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(manager, { wipLimits: { review: 2 } })

    const otherOrg = useCasesAs(unitOfWork, otherManager)
    await expect(otherOrg.boardSettings.get.execute(otherManager)).resolves.toMatchObject({
      wipLimits: {},
      updatedAt: null,
    })
  })

  it('o dashboard lista as colunas acima do limite contando todas as tarefas da organização', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const useCases = useCasesAs(unitOfWork, manager)
    const project = await seedUsers(unitOfWork)
    await useCases.boardSettings.setWipLimits.execute(manager, {
      wipLimits: { in_progress: 3, review: 2 },
    })
    const tasks = [
      taskFor(1, userId, 'in_progress'),
      taskFor(2, userId, 'in_progress'),
      taskFor(3, otherUserId, 'in_progress', false),
      taskFor(4, otherUserId, 'in_progress', false),
      taskFor(5, otherUserId, 'in_progress', false),
      taskFor(6, otherUserId, 'review', false),
      taskFor(7, userId, 'review'),
    ]
    for (const task of tasks)
      await unitOfWork.repositories.tasks.save(organizationId, { ...task, projectId: project.id })

    const dashboard = await useCases.dashboard.get.execute(manager)
    expect(dashboard.insights?.overWipColumns).toEqual([
      { status: 'in_progress', count: 5, limit: 3 },
    ])

    await expect(useCases.dashboard.get.execute(collaborator)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    )
  })
})
