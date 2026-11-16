import { createTenantContext } from '../../tenant-context'
import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createProject,
  createTask,
  createUser,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, Project, Task, User } from '@agilebox/core'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const foreignOrganizationId = toOrganizationId('00000000000000000000000009')
const collaboratorId = toUserId('00000000000000000000000002')
const otherId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const projectId = toProjectId('00000000000000000000000005')
const now = '2026-01-02T00:00:00.000Z'
const collaborator: Actor = { userId: collaboratorId, organizationId, role: 'collaborator' }
const other: Actor = { userId: otherId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function user(id: typeof collaboratorId, name: string, role: User['role'] = 'collaborator'): User {
  return createUser({
    id,
    organizationId,
    name,
    email: `${name.toLowerCase()}@x.test`,
    role,
    defaultRateCents: 4500,
    createdAt: now,
  })
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    ...createProject({
      id: projectId,
      organizationId,
      name: 'Projeto A',
      createdBy: collaboratorId,
      createdAt: now,
    }),
    ...overrides,
  }
}

function task(
  id: string,
  createdBy: typeof collaboratorId,
  number: number,
  title = 'Tarefa',
): Task {
  return createTask({
    id: toTaskId(id),
    organizationId,
    number,
    projectId,
    projectName: 'Projeto A',
    createdBy,
    title,
    createdAt: now,
    responsibleParticipationId: toParticipationId(`0000000000000000000000${id.slice(-4)}`),
    responsibleRateCents: 4500,
  })
}

function setup(actorOf: Actor = collaborator) {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actorOf, set: () => undefined }
  const repos = unitOfWork.repositories
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock(now),
    checklist: repos.checklist,
    retroActions: repos.retroActions,
    dailyEntries: repos.dailyEntries,
    teamTools: repos.teamTools,
    definitionOfDone: repos.definitionOfDone,
    comments: repos.comments,
    boardSettings: repos.boardSettings,
    contributors: repos.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: repos.meetings,
    organizations: repos.organizations,
    participations: repos.participations,
    projects: repos.projects,
    taskOpens: repos.taskOpens,
    tasks: repos.tasks,
    timeline: repos.timeline,
    unitOfWork,
    users: repos.users,
  })
  return { useCases, repos }
}

async function seed(repos: InMemoryUnitOfWork['repositories']) {
  await repos.users.save(organizationId, user(collaboratorId, 'Ana'))
  await repos.users.save(organizationId, user(otherId, 'Bruno'))
  await repos.users.save(organizationId, user(managerId, 'Gestor', 'manager'))
  await repos.projects.save(organizationId, project())
  for (const id of [collaboratorId, otherId, managerId]) {
    await repos.projects.addMember(organizationId, {
      projectId,
      userId: id,
      addedBy: collaboratorId,
      addedAt: now,
    })
  }
  await repos.tasks.save(
    organizationId,
    task('00000000000000000000000100', collaboratorId, 1, 'Relatório mensal'),
  )
  await repos.tasks.save(
    organizationId,
    task('00000000000000000000000200', otherId, 2, 'Deploy de homologação'),
  )
}

const ID_MINE = '00000000000000000000000100'
const ID_OTHER = '00000000000000000000000200'

describe('arquivar e desarquivar tarefa', () => {
  it('quem participa arquiva: grava quando e quem, e a linha do tempo registra sem marca de gestor', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    const dto = await useCases.tasks.archive.execute(createTenantContext(collaborator), {
      taskId: ID_MINE,
    })
    expect(dto).toMatchObject({ archivedAt: now })
    const saved = await repos.tasks.findById(organizationId, toTaskId(ID_MINE))
    expect(saved).toMatchObject({ archivedAt: now, archivedBy: collaboratorId })
    const events = await repos.timeline.listByTask(organizationId, toTaskId(ID_MINE))
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'task_archived',
        asManager: false,
        actorUserId: collaboratorId,
      }),
    )
  })

  it('gestor arquiva tarefa de outra pessoa e a linha do tempo recebe a marca Gestor', async () => {
    const { useCases, repos } = setup(manager)
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(manager), { taskId: ID_OTHER })
    const events = await repos.timeline.listByTask(organizationId, toTaskId(ID_OTHER))
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'task_archived', asManager: true, actorUserId: managerId }),
    )
    expect(await repos.tasks.findById(organizationId, toTaskId(ID_OTHER))).toMatchObject({
      archivedBy: managerId,
    })
  })

  it('colaborador sem participação não arquiva: FORBIDDEN', async () => {
    const { useCases, repos } = setup(other)
    await seed(repos)
    await useCases.tasks.archive
      .execute(createTenantContext(collaborator), { taskId: ID_MINE })
      .catch(() => undefined)
    await expect(
      useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_OTHER }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(await repos.tasks.findById(organizationId, toTaskId(ID_OTHER))).toMatchObject({
      archivedAt: null,
    })
  })

  it('tarefa de outra organização não é encontrada: NOT_FOUND', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await repos.tasks.save(foreignOrganizationId, {
      ...task('00000000000000000000000300', collaboratorId, 9),
      organizationId: foreignOrganizationId,
    })
    await expect(
      useCases.tasks.archive.execute(createTenantContext(collaborator), {
        taskId: '00000000000000000000000300',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('tarefa arquivada não pode ser editada, movida nem comentada; arquivar de novo é conflito', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_MINE })
    await expect(
      useCases.tasks.update.execute(createTenantContext(collaborator), {
        taskId: ID_MINE,
        changes: { title: 'Novo' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      useCases.tasks.move.execute(createTenantContext(collaborator), {
        taskId: ID_MINE,
        status: 'todo',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_MINE }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('desarquivar devolve a tarefa às visões e registra o evento; desarquivar ativa é conflito', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_MINE })
    const restored = await useCases.tasks.unarchive.execute(createTenantContext(collaborator), {
      taskId: ID_MINE,
    })
    expect(restored).toMatchObject({ archivedAt: null })
    const saved = await repos.tasks.findById(organizationId, toTaskId(ID_MINE))
    expect(saved).toMatchObject({ archivedAt: null, archivedBy: null, title: 'Relatório mensal' })
    const types = (await repos.timeline.listByTask(organizationId, toTaskId(ID_MINE))).map(
      (e) => e.type,
    )
    expect(types).toContain('task_unarchived')
    await expect(
      useCases.tasks.unarchive.execute(createTenantContext(collaborator), { taskId: ID_MINE }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    await useCases.tasks.update.execute(createTenantContext(collaborator), {
      taskId: ID_MINE,
      changes: { title: 'Depois' },
    })
  })

  it('tarefa arquivada some das visões padrão e volta com includeArchived; GetTask abre em leitura', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_MINE })

    const board = await useCases.tasks.listBoard.execute(createTenantContext(collaborator), {})
    expect(board.tasks.map((t) => t.id)).not.toContain(ID_MINE)
    const withArchived = await useCases.tasks.listBoard.execute(createTenantContext(collaborator), {
      includeArchived: true,
    })
    expect(withArchived.tasks.map((t) => t.id)).toContain(ID_MINE)

    const team = await useCases.tasks.listTeamBoard.execute(createTenantContext(manager), {})
    expect(team.map((t) => t.id)).not.toContain(ID_MINE)
    const teamAll = await useCases.tasks.listTeamBoard.execute(createTenantContext(manager), {
      includeArchived: true,
    })
    expect(teamAll.map((t) => t.id)).toContain(ID_MINE)

    expect(
      (await useCases.tasks.listRecent.execute(createTenantContext(collaborator))).map((t) => t.id),
    ).not.toContain(ID_MINE)
    await useCases.tasks.recordOpen.execute(createTenantContext(collaborator), { taskId: ID_MINE })
    expect(
      (await useCases.tasks.listFrequent.execute(createTenantContext(collaborator))).map(
        (t) => t.id,
      ),
    ).not.toContain(ID_MINE)

    expect(
      (
        await useCases.tasks.search.execute(createTenantContext(collaborator), {
          query: 'Relatório',
        })
      ).map((t) => t.id),
    ).toEqual([])
    expect(
      (await useCases.tasks.search.execute(createTenantContext(collaborator), { query: '1' })).map(
        (t) => t.id,
      ),
    ).toEqual([])

    const detail = await useCases.tasks.getDetail.execute(createTenantContext(collaborator), {
      taskId: ID_MINE,
    })
    expect(detail).toMatchObject({ archivedAt: now, canEdit: false })
  })

  it('dashboard do gestor não conta tarefas arquivadas', async () => {
    const { useCases, repos } = setup(manager)
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(manager), { taskId: ID_OTHER })
    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager))
    const ana = dashboard.collaborators.find((stat) => stat.user.name === 'Ana')
    const bruno = dashboard.collaborators.find((stat) => stat.user.name === 'Bruno')
    expect(ana?.taskCount).toBe(1)
    expect(bruno).toBeUndefined()
  })

  it('isola organizações: o quadro de outra organização não traz tarefas arquivadas daqui', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await useCases.tasks.archive.execute(createTenantContext(collaborator), { taskId: ID_MINE })
    await repos.organizations.save(
      createOrganization({
        id: foreignOrganizationId,
        name: 'Outra',
        taskPrefix: 'OUT',
        createdAt: now,
      }),
    )
    const foreignManager: Actor = {
      userId: managerId,
      organizationId: foreignOrganizationId,
      role: 'manager',
    }
    const board = await useCases.tasks.listBoard.execute(createTenantContext(foreignManager), {
      includeArchived: true,
    })
    expect(board.tasks).toEqual([])
  })
})

describe('projeto arquivado', () => {
  it('arquivado some da lista e as tarefas somem das visões; desarquivar as devolve como estavam', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    const before = await repos.tasks.findById(organizationId, toTaskId(ID_MINE))
    await useCases.projects.archive.execute(createTenantContext(collaborator), { projectId })
    expect(
      (await useCases.projects.listProjects.execute(createTenantContext(collaborator))).map(
        (p) => p.id,
      ),
    ).not.toContain(projectId)
    expect(
      (
        await useCases.projects.listProjects.execute(createTenantContext(collaborator), {
          includeArchived: true,
        })
      ).map((p) => p.id),
    ).toContain(projectId)
    expect(
      (await useCases.tasks.listBoard.execute(createTenantContext(collaborator), {})).tasks,
    ).toEqual([])
    expect(
      (
        await useCases.tasks.listBoard.execute(createTenantContext(collaborator), {
          includeArchived: true,
        })
      ).tasks.length,
    ).toBe(1)
    expect(await repos.tasks.findById(organizationId, toTaskId(ID_MINE))).toEqual(before)

    await useCases.projects.unarchive.execute(createTenantContext(collaborator), { projectId })
    expect(
      (await useCases.tasks.listBoard.execute(createTenantContext(collaborator), {})).tasks.map(
        (t) => t.id,
      ),
    ).toEqual([ID_MINE])
  })

  it('projeto arquivado não aceita tarefa nova: CONFLICT', async () => {
    const { useCases, repos } = setup()
    await seed(repos)
    await useCases.projects.archive.execute(createTenantContext(collaborator), { projectId })
    await expect(
      useCases.tasks.create.execute(createTenantContext(collaborator), {
        projectId,
        title: 'Nova',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('só o gestor e o criador do projeto arquivam: colaborador de fora recebe FORBIDDEN', async () => {
    const { useCases, repos } = setup(other)
    await seed(repos)
    await expect(
      useCases.projects.archive.execute(createTenantContext(other), { projectId }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      useCases.projects.archive.execute(
        createTenantContext({ ...collaborator, organizationId: foreignOrganizationId }),
        { projectId },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.projects.archive.execute(createTenantContext(manager), { projectId }),
    ).resolves.toMatchObject({
      archivedAt: now,
    })
  })
})
