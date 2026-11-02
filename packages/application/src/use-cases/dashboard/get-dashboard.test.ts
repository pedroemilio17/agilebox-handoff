import { describe, expect, it } from 'vitest'
import {
  createTenantContext,
  createUser,
  sendToBacklog,
  setStatus,
  toOrganizationId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, ModuleState, Task } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000004')
const collaborator: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const timestamp = '2026-01-01T00:00:00.000Z'

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => manager, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
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

/** Tarefa de Ana com o estado dado; `rank` a põe no backlog. */
function aTaskOf(n: number, status: Task['status'], rank?: number): Task {
  const task = setStatus(
    aTask()
      .with({
        id: toTaskId(String(n).padStart(26, '0')),
        organizationId,
        createdBy: userId,
        title: `Tarefa ${n}`,
      })
      .build(),
    status,
  )
  return rank === undefined ? task : sendToBacklog(task, rank)
}

/** Três tarefas: uma no quadro (a fazer), duas no backlog (concluída e em planejamento). */
async function seedBoardAndBacklog(unitOfWork: InMemoryUnitOfWork) {
  const repos = unitOfWork.repositories
  await repos.users.save(organizationId, aUser().with({ id: userId, name: 'Ana Silva' }).build())
  await repos.users.save(
    organizationId,
    createUser({
      ...aUser().with({ id: managerId, name: 'Gestora' }).build(),
      role: 'manager',
    }),
  )
  await repos.projects.save(organizationId, aProject().build())
  await repos.tasks.save(organizationId, aTaskOf(501, 'todo'))
  await repos.tasks.save(organizationId, aTaskOf(502, 'done', 1))
  await repos.tasks.save(organizationId, aTaskOf(503, 'planning', 2))
}

async function setBacklogState(
  unitOfWork: InMemoryUnitOfWork,
  state: ModuleState | null,
): Promise<void> {
  if (state === null) return
  await unitOfWork.repositories.teamModules.save(organizationId, {
    moduleId: 'backlog',
    state,
    config: {},
    changedBy: managerId,
    changedAt: timestamp,
  })
}

describe('dashboard do gestor e o Backlog (B1 A)', () => {
  it('com o Backlog ativo, conta só as tarefas do quadro, como o quadro mostra', async () => {
    const { useCases, unitOfWork } = setup()
    await seedBoardAndBacklog(unitOfWork)
    await setBacklogState(unitOfWork, 'active')

    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager), manager)

    expect(dashboard.distribution).toEqual({
      planning: 0,
      todo: 100,
      in_progress: 0,
      review: 0,
      done: 0,
    })
    expect(dashboard.collaborators).toHaveLength(1)
    expect(dashboard.collaborators[0]).toMatchObject({ user: { id: userId }, taskCount: 1 })
  })

  it('com o Backlog encerrando, o backlog segue fora das contas', async () => {
    const { useCases, unitOfWork } = setup()
    await seedBoardAndBacklog(unitOfWork)
    await setBacklogState(unitOfWork, 'winding_down')

    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager), manager)

    expect(dashboard.distribution.todo).toBe(100)
    expect(dashboard.collaborators[0]).toMatchObject({ taskCount: 1 })
  })

  it('com o Backlog desativado, conta tudo, como antes do backlog', async () => {
    const { useCases, unitOfWork } = setup()
    await seedBoardAndBacklog(unitOfWork)
    await setBacklogState(unitOfWork, 'disabled')

    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager), manager)

    expect(dashboard.distribution).toEqual({
      planning: 34,
      todo: 33,
      in_progress: 0,
      review: 0,
      done: 33,
    })
    expect(dashboard.collaborators[0]).toMatchObject({ taskCount: 3 })
  })

  it('com o Backlog nunca gravado, conta tudo, como antes do backlog', async () => {
    const { useCases, unitOfWork } = setup()
    await seedBoardAndBacklog(unitOfWork)
    await setBacklogState(unitOfWork, null)

    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager), manager)

    expect(dashboard.distribution).toEqual({
      planning: 34,
      todo: 33,
      in_progress: 0,
      review: 0,
      done: 33,
    })
    expect(dashboard.collaborators[0]).toMatchObject({ taskCount: 3 })
  })

  it('o colaborador continua sem acesso ao dashboard', async () => {
    const { useCases, unitOfWork } = setup()
    await seedBoardAndBacklog(unitOfWork)

    await expect(
      useCases.dashboard.get.execute(createTenantContext(collaborator), collaborator),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
