import { createTenantContext } from '../../tenant-context'
import { describe, expect, it, vi } from 'vitest'
import {
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
  parseDateOnly,
  toEventId,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'
import { aProject, aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const foreignOrganizationId = toOrganizationId('00000000000000000000000009')

/** Mesma tarefa, com o participante trocado: a pessoa passa a ser Responsável ou Apoio dela. */
function involving(task: Task, participantUserId: typeof managerId): Task {
  return {
    ...task,
    participations: task.participations.map((participation) => ({
      ...participation,
      participant: { kind: 'user' as const, userId: participantUserId },
    })),
  }
}

const idsOf = (tasks: readonly { readonly id: string }[]) => tasks.map(({ id }) => id).sort()

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    acceptance: unitOfWork.repositories.acceptance,
    retroActions: unitOfWork.repositories.retroActions,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    teamTools: unitOfWork.repositories.teamTools,
    projectModules: unitOfWork.repositories.projectModules,
    projectSetup: unitOfWork.repositories.projectSetup,
    sprints: unitOfWork.repositories.sprints,
    sprintTasks: unitOfWork.repositories.sprintTasks,
    impediments: unitOfWork.repositories.impediments,
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

async function addProjectMember(
  unitOfWork: InMemoryUnitOfWork,
  projectId: ReturnType<typeof toProjectId>,
  memberId: ReturnType<typeof toUserId>,
) {
  await unitOfWork.repositories.projects.addMember(organizationId, {
    projectId,
    userId: memberId,
    addedBy: memberId,
    addedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('listas de tarefas', () => {
  it('calcula ciclo semanal só do quadro autorizado e não libera filtro de outra pessoa ao colaborador', async () => {
    const { useCases, unitOfWork } = setup()
    const mine = { ...aTask().build(), status: 'done' as const, createdAt: '2025-12-28T12:00:00Z' }
    const other = {
      ...mine,
      id: toTaskId('00000000000000000000000020'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, other)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      {
        id: toEventId('00000000000000000000000021'),
        taskId: mine.id,
        actorUserId: userId,
        asManager: false,
        at: '2025-12-29T12:00:00Z',
        type: 'status_changed',
        payload: { before: 'todo', after: 'in_progress' },
      },
      {
        id: toEventId('00000000000000000000000022'),
        taskId: mine.id,
        actorUserId: userId,
        asManager: false,
        at: '2026-01-01T12:00:00Z',
        type: 'status_changed',
        payload: { before: 'in_progress', after: 'done' },
      },
    ])
    const timeline = vi.spyOn(unitOfWork.repositories.timeline, 'listByTask')
    expect(await useCases.tasks.getBoardFlow.execute(createTenantContext(actor), {})).toMatchObject(
      {
        cycleDays: 3,
        weekStart: '2025-12-29',
      },
    )
    expect(timeline).toHaveBeenCalledExactlyOnceWith(organizationId, mine.id)
    await expect(
      useCases.tasks.getBoardFlow.execute(createTenantContext(actor), { forUserId: otherUserId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await useCases.tasks.getBoardFlow.execute(
        createTenantContext({ ...actor, role: 'manager' }),
        { forUserId: otherUserId },
      ),
    ).toMatchObject({ cycleDays: null })
  })

  it('deriva sinais apenas das tarefas acessíveis e usa mudança de estado em vez da última edição', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = {
      ...aTask().inProject(project).build(),
      status: 'review' as const,
      createdAt: '2025-12-01T12:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deadline: parseDateOnly('2025-12-30'),
    }
    const hidden = {
      ...mine,
      id: toTaskId('00000000000000000000000010'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, hidden)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      {
        id: toEventId('00000000000000000000000011'),
        taskId: mine.id,
        at: '2025-12-20T12:00:00.000Z',
        actorUserId: userId,
        asManager: false,
        type: 'status_changed',
        payload: { before: 'in_progress', after: 'review' },
      },
    ])
    const timeline = vi.spyOn(unitOfWork.repositories.timeline, 'listByTask')
    const { tasks: result } = await useCases.tasks.listBoard.execute(createTenantContext(actor), {})
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: mine.id, overdue: true })
    expect(result[0]!.agingDays).toBeGreaterThan(4)
    expect(timeline).toHaveBeenCalledExactlyOnceWith(organizationId, mine.id)
  })

  it('lista no quadro pessoal só tarefas de que o colaborador participa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = aTask().inProject(project).build()
    const others = {
      ...mine,
      id: toTaskId('00000000000000000000000010'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, others)

    const { tasks: result } = await useCases.tasks.listBoard.execute(createTenantContext(actor), {})

    expect(result.map(({ id }) => id)).toEqual([mine.id])
  })

  it('restringe o filtro por usuário ao gestor e mantém o filtro de projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const task = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000011'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, task)

    await expect(
      useCases.tasks.listBoard.execute(createTenantContext(actor), { forUserId: otherUserId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.tasks.listBoard.execute(
        createTenantContext({ userId: managerId, organizationId, role: 'manager' }),
        { projectId: project.id, forUserId: otherUserId },
      ),
    ).resolves.toMatchObject({ tasks: [{ id: task.id }] })
  })

  it('lista na Equipe tarefas dos projetos do membro sem incluir as próprias', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = aTask().inProject(project).build()
    const team = {
      ...mine,
      id: toTaskId('00000000000000000000000012'),
      createdBy: otherUserId,
      participations: [],
    }
    const unrelatedProject = aProject()
      .with({ id: toProjectId('00000000000000000000000005') })
      .build()
    const unrelated = {
      ...team,
      id: toTaskId('00000000000000000000000013'),
      projectId: unrelatedProject.id,
      projectName: unrelatedProject.name,
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.save(organizationId, unrelatedProject)
    await addProjectMember(unitOfWork, project.id, userId)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, team)
    await unitOfWork.repositories.tasks.save(organizationId, unrelated)

    const result = await useCases.tasks.listTeamBoard.execute(createTenantContext(actor), {})

    expect(result.map(({ id }) => id)).toEqual([team.id])
  })

  it('Minhas tarefas do gestor mostra só as tarefas de que ele participa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const created = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000030'),
      createdBy: managerId,
      participations: [],
    }
    const assigned = {
      ...involving(aTask().inProject(project).build(), managerId),
      id: toTaskId('00000000000000000000000031'),
      createdBy: otherUserId,
    }
    const others = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000032'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    for (const task of [created, assigned, others])
      await unitOfWork.repositories.tasks.save(organizationId, task)

    const { tasks: result } = await useCases.tasks.listBoard.execute(
      createTenantContext(manager),
      {},
    )

    expect(idsOf(result)).toEqual(idsOf([created, assigned]))
  })

  it('Equipe do gestor mostra todas as tarefas da organização, inclusive as em que ele participa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const created = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000033'),
      createdBy: managerId,
      participations: [],
    }
    const assigned = {
      ...involving(aTask().inProject(project).build(), managerId),
      id: toTaskId('00000000000000000000000034'),
      createdBy: otherUserId,
    }
    const others = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000035'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    for (const task of [created, assigned, others])
      await unitOfWork.repositories.tasks.save(organizationId, task)

    const result = await useCases.tasks.listTeamBoard.execute(createTenantContext(manager), {})

    expect(idsOf(result)).toEqual(idsOf([created, assigned, others]))
  })

  it('nenhuma visão mostra tarefas de outra organização, mesmo com o mesmo projeto e o mesmo criador', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000036'),
      createdBy: managerId,
      participations: [],
    }
    const foreign = {
      ...mine,
      id: toTaskId('00000000000000000000000037'),
      organizationId: foreignOrganizationId,
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await addProjectMember(unitOfWork, project.id, userId)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(foreignOrganizationId, foreign)

    expect(
      idsOf((await useCases.tasks.listBoard.execute(createTenantContext(manager), {})).tasks),
    ).toEqual([mine.id])
    expect(
      idsOf(await useCases.tasks.listTeamBoard.execute(createTenantContext(manager), {})),
    ).toEqual([mine.id])
    // Colaborador: a tarefa do gestor aparece na Equipe do projeto dele, não no próprio quadro.
    expect((await useCases.tasks.listBoard.execute(createTenantContext(actor), {})).tasks).toEqual(
      [],
    )
    expect(
      idsOf(await useCases.tasks.listTeamBoard.execute(createTenantContext(actor), {})),
    ).toEqual([mine.id])
  })

  it('traz na Equipe os sinais de parada e de prazo, como o quadro', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const team = {
      ...aTask().inProject(project).build(),
      id: toTaskId('00000000000000000000000014'),
      status: 'review' as const,
      createdBy: otherUserId,
      participations: [],
      createdAt: '2025-12-01T12:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deadline: parseDateOnly('2025-12-30'),
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await addProjectMember(unitOfWork, project.id, userId)
    await unitOfWork.repositories.tasks.save(organizationId, team)

    const [result] = await useCases.tasks.listTeamBoard.execute(createTenantContext(actor), {})

    expect(result).toMatchObject({ id: team.id, overdue: true })
    expect(result!.agingDays).toBeGreaterThan(4)
  })

  it('recentes, frequentes e busca retornam somente tarefas de que o ator participa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = aTask().inProject(project).build()
    const other = {
      ...mine,
      id: toTaskId('00000000000000000000000014'),
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, other)
    await unitOfWork.repositories.taskOpens.recordOpen(
      organizationId,
      mine.id,
      userId,
      '2026-01-02T00:00:00.000Z',
    )

    await expect(
      useCases.tasks.listRecent.execute(createTenantContext(actor)),
    ).resolves.toMatchObject([{ id: mine.id }])
    await expect(
      useCases.tasks.listFrequent.execute(createTenantContext(actor)),
    ).resolves.toMatchObject([{ id: mine.id }])
    await expect(
      useCases.tasks.search.execute(createTenantContext(actor), { query: mine.title }),
    ).resolves.toMatchObject([{ id: mine.id }])
  })

  it('busca pelo ID ou pelo número, respeitando o acesso', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const mine = { ...aTask().inProject(project).build(), number: 118 }
    const hidden = {
      ...mine,
      id: toTaskId('00000000000000000000000017'),
      number: 119,
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, hidden)

    await expect(
      useCases.tasks.search.execute(createTenantContext(actor), { query: 'ab-118' }),
    ).resolves.toMatchObject([{ id: mine.id, key: 'AB-118' }])
    await expect(
      useCases.tasks.search.execute(createTenantContext(actor), { query: '118' }),
    ).resolves.toMatchObject([{ id: mine.id }])
    await expect(
      useCases.tasks.search.execute(createTenantContext(actor), { query: 'XY-118' }),
    ).resolves.toEqual([])
    await expect(
      useCases.tasks.search.execute(createTenantContext(actor), { query: '119' }),
    ).resolves.toEqual([])
  })

  it('registra abertura somente quando o ator tem acesso à tarefa', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const task = aTask().inProject(project).build()
    const hiddenProject = aProject()
      .with({ id: toProjectId('00000000000000000000000016'), name: 'Outro projeto' })
      .build()
    const hidden = {
      ...task,
      id: toTaskId('00000000000000000000000015'),
      projectId: hiddenProject.id,
      projectName: hiddenProject.name,
      createdBy: otherUserId,
      participations: [],
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.save(organizationId, hiddenProject)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.tasks.save(organizationId, hidden)

    await useCases.tasks.recordOpen.execute(createTenantContext(actor), { taskId: task.id })
    await expect(
      useCases.tasks.recordOpen.execute(createTenantContext(actor), { taskId: hidden.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.tasks.recordOpen.execute(
        createTenantContext({
          ...actor,
          organizationId: toOrganizationId('00000000000000000000000009'),
        }),
        { taskId: task.id },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(unitOfWork.state.taskOpens.get(organizationId)?.get(`${userId}:${task.id}`)).toEqual({
      openedAt: '2026-01-02T00:00:00.000Z',
      count: 1,
    })
  })

  it('ordena Frequentes pela abertura mais recente', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const first = aTask().inProject(project).build()
    const second = {
      ...first,
      id: toTaskId('00000000000000000000000017'),
      updatedAt: '2026-01-02T00:00:00.000Z',
    }
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.tasks.save(organizationId, first)
    await unitOfWork.repositories.tasks.save(organizationId, second)
    await unitOfWork.repositories.taskOpens.recordOpen(
      organizationId,
      first.id,
      userId,
      '2026-01-01T00:00:00.000Z',
    )
    await unitOfWork.repositories.taskOpens.recordOpen(
      organizationId,
      second.id,
      userId,
      '2026-01-02T00:00:00.000Z',
    )

    const result = await useCases.tasks.listFrequent.execute(createTenantContext(actor))

    expect(result.map(({ id }) => id)).toEqual([second.id, first.id])
  })
})
