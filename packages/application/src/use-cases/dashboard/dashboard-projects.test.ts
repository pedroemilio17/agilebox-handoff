import { describe, expect, it } from 'vitest'
import {
  createAcceptanceCriterion,
  createTimelineEvent,
  parseDateOnly,
  PermissionDeniedError,
  toAcceptanceCriterionId,
  toBoardSettingsId,
  toEventId,
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, Project, Task, TimelineEvent } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const NOW = '2026-01-02T12:00:00.000Z'
const organizationId = toOrganizationId('00000000000000000000000001')
const managerId = toUserId('00000000000000000000000004')
const collaboratorId = toUserId('00000000000000000000000002')
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const collaborator: Actor = { userId: collaboratorId, organizationId, role: 'collaborator' }

function setup(actor: Actor = manager) {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const repos = unitOfWork.repositories
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock(NOW),
    checklist: repos.checklist,
    acceptance: repos.acceptance,
    retroActions: repos.retroActions,
    dailyEntries: repos.dailyEntries,
    teamTools: repos.teamTools,
    projectModules: repos.projectModules,
    projectSetup: repos.projectSetup,
    guideProgress: repos.guideProgress,
    sprints: repos.sprints,
    sprintTasks: repos.sprintTasks,
    deliverables: repos.deliverables,
    taskDependencies: repos.taskDependencies,
    milestones: repos.milestones,
    risks: repos.risks,
    baselines: repos.baselines,
    impediments: repos.impediments,
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
  return { useCases, unitOfWork }
}

function event(overrides: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'taskId' | 'at'>) {
  return createTimelineEvent({
    actorUserId: managerId,
    asManager: false,
    type: 'status_changed',
    payload: { before: 'todo', after: 'in_progress' },
    ...overrides,
  } as TimelineEvent)
}

/** Projeto ágil com três tarefas: uma vencida e parada, uma concluída com aceite pendente e uma aberta da colaboradora. */
async function seedAgile(
  unitOfWork: InMemoryUnitOfWork,
  modules: readonly string[] = ['acceptance'],
) {
  const repos = unitOfWork.repositories
  await repos.users.save(organizationId, {
    ...aUser().with({ id: managerId, name: 'Gestor' }).build(),
    role: 'manager',
  })
  await repos.users.save(
    organizationId,
    aUser().with({ id: collaboratorId, name: 'Colaboradora' }).build(),
  )
  const project: Project = {
    ...aProject().build(),
    id: toProjectId('00000000000000000000000100'),
    name: 'App de Chamados',
  }
  await repos.projects.save(organizationId, project)
  await repos.projectSetup.save(organizationId, {
    projectId: project.id,
    answers: null,
    recommendedPreset: null,
    startedFromPreset: 'agil',
    guideLevel: null,
  })
  await repos.projectModules.save(
    organizationId,
    project.id,
    modules.map((moduleId) => ({ moduleId: moduleId as never, state: 'active' as const })),
    managerId,
    NOW,
  )
  // `createTask` zera status, prazo e estimativa: esses campos entram depois de criar a tarefa.
  const late: Task = {
    ...aTask()
      .inProject(project)
      .ownedBy({ ...aUser().build(), id: collaboratorId })
      .build(),
    id: toTaskId('00000000000000000000001001'),
    title: 'Ajustar login',
    status: 'in_progress',
    deadline: parseDateOnly('2025-12-30'),
  }
  const done: Task = {
    ...aTask().inProject(project).build(),
    id: toTaskId('00000000000000000000001002'),
    title: 'Texto de ajuda',
    status: 'done',
  }
  const open: Task = {
    ...aTask()
      .inProject(project)
      .ownedBy({ ...aUser().build(), id: collaboratorId })
      .build(),
    id: toTaskId('00000000000000000000001003'),
    title: 'Relatório',
    status: 'todo',
    estimatedHoursHundredths: 500,
  }
  for (const task of [late, done, open]) await repos.tasks.save(organizationId, task)
  await repos.acceptance.saveMany(organizationId, [
    createAcceptanceCriterion({
      id: toAcceptanceCriterionId('00000000000000000000002001'),
      organizationId,
      taskId: done.id,
      text: 'Texto de ajuda atualizado',
      done: false,
      position: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  ])
  await repos.timeline.saveMany(organizationId, [
    event({
      id: toEventId('00000000000000000000003001'),
      taskId: late.id,
      at: '2025-12-20T09:00:00.000Z',
    }),
    event({
      id: toEventId('00000000000000000000003002'),
      taskId: late.id,
      at: '2026-01-01T09:00:00.000Z',
      asManager: true,
      actorUserId: managerId,
    }),
  ])
  return { project, late, done, open }
}

describe('dashboard.get: cartões, Precisa de você, atualizações e equipe', () => {
  it('colaborador não acessa o dashboard', async () => {
    const { useCases } = setup(collaborator)
    await expect(useCases.dashboard.get.execute(createTenantContext(collaborator))).rejects.toThrow(
      PermissionDeniedError,
    )
  })

  it('projeto sem sprint ativa, sem fluxo e sem preset cai no progresso; a saúde segue a regra (vencida = Risco)', async () => {
    const { useCases, unitOfWork } = setup()
    await seedAgile(unitOfWork)
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    const [card] = insights.projects
    expect(card!.name).toBe('App de Chamados')
    expect(card!.method).toBe('agil')
    expect(card!.kpi.kind).toBe('progress')
    expect(card!.health).toBe('risk')
    expect(card!.healthReason).toBe('1 tarefa vencida')
  })

  it('"Precisa de você" traz aceite pendente só com o módulo acceptance ligado', async () => {
    const { useCases, unitOfWork } = setup()
    await seedAgile(unitOfWork)
    const withModule = (await useCases.dashboard.get.execute(createTenantContext(manager)))
      .insights!
    expect(withModule.needs.map((need) => need.kind)).toEqual(['acceptance'])
    expect(withModule.needs[0]!.text).toBe(
      'Texto de ajuda foi concluída sem “Texto de ajuda atualizado”.',
    )

    const other = setup()
    await seedAgile(other.unitOfWork, [])
    const withoutModule = (await other.useCases.dashboard.get.execute(createTenantContext(manager)))
      .insights!
    expect(withoutModule.needs).toEqual([])
  })

  it('atualizações: só os últimos sete dias, da mais recente para a mais antiga, com categoria e gestor', async () => {
    const { useCases, unitOfWork } = setup()
    await seedAgile(unitOfWork)
    const { updates } = (await useCases.dashboard.get.execute(createTenantContext(manager)))
      .insights!
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      taskTitle: 'Ajustar login',
      projectName: 'App de Chamados',
      projectMethod: 'agil',
      category: 'status',
      asManager: true,
      actorName: 'Gestor',
    })
  })

  it('equipe: parada, vencida, aceite pendente, carga das tarefas abertas e projetos da pessoa', async () => {
    const { useCases, unitOfWork } = setup()
    await seedAgile(unitOfWork)
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    const person = insights.team.find((member) => member.user.id === collaboratorId)!
    expect(person.projects).toEqual([{ id: '00000000000000000000000100', name: 'App de Chamados' }])
    expect(person.overdueDays).toBe(3)
    expect(person.staleDays).toBeNull()
    expect(person.loadHours).toBe(5)
    // A tarefa concluída com aceite pendente é do padrão do builder, que é a colaboradora.
    expect(person.acceptancePendingCount).toBe(1)
  })

  it('projeto arquivado não aparece nos cartões', async () => {
    const { useCases, unitOfWork } = setup()
    const { project } = await seedAgile(unitOfWork)
    await unitOfWork.repositories.projects.save(organizationId, {
      ...project,
      archivedAt: NOW,
      archivedBy: managerId,
    })
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    expect(insights.projects).toEqual([])
  })

  it('WIP acima do limite vira sinal, com o módulo wip ligado no projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const { late } = await seedAgile(unitOfWork, ['wip'])
    // Segunda tarefa em andamento: duas no limite de uma.
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...late,
      id: toTaskId('00000000000000000000001004'),
      title: 'Outra tarefa',
    })
    await unitOfWork.repositories.boardSettings.save(organizationId, {
      id: toBoardSettingsId('00000000000000000000004001'),
      organizationId,
      wipLimits: { todo: 0, in_progress: 1 },
      updatedAt: NOW,
      updatedBy: managerId,
    })
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    expect(insights.needs.map((need) => need.kind)).toEqual(['wip'])
    expect(insights.needs[0]!.text).toBe('Desenvolvendo está com 2 de 1.')
    expect(insights.projects[0]!.health).toBe('risk')
  })
})
