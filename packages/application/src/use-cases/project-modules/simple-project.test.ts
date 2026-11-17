import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  MODULE_IDS,
  PermissionDeniedError,
  toOrganizationId,
  toUserId,
} from '@agilebox/core'
import type { Actor, ModuleId } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

/**
 * Projeto Simples de ponta a ponta (ADR-10, regra 1): sem nenhum módulo ligado no projeto, o
 * núcleo funciona inteiro. Equipe com todas as ferramentas desligadas exceto o núcleo, como em
 * `team-tools.test.ts`. Tudo pela fronteira `forTenant` (`createUseCases`), com fakes em memória.
 */

const NOW = '2026-11-16T12:00:00.000Z'
const DEADLINE = '2026-11-30'

const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const collaboratorId = toUserId('00000000000000000000000011')
const managerAId = toUserId('00000000000000000000000012')
const managerBId = toUserId('00000000000000000000000021')
const managerA: Actor = { userId: managerAId, organizationId: orgA, role: 'manager' }
const contextManagerA: TenantContext = createTenantContext(managerA)

/** Todas as ferramentas da equipe, exceto o núcleo (que nunca se desliga). */
const NON_CORE_MODULES = MODULE_IDS.filter((id): id is ModuleId => id !== 'core')

async function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const repositories = unitOfWork.repositories
  for (const [id, name, taskPrefix] of [
    [orgA, 'Time A', 'AAA'],
    [orgB, 'Time B', 'BBB'],
  ] as const)
    await repositories.organizations.save(
      createOrganization({ id, name, taskPrefix, createdAt: '2026-01-01T00:00:00.000Z' }),
    )
  const people = [
    [orgA, collaboratorId, 'Ana', 'collaborator', 'ana@example.com'],
    [orgA, managerAId, 'Gestora A', 'manager', 'gestora-a@example.com'],
    [orgB, managerBId, 'Gestor B', 'manager', 'gestor-b@example.com'],
  ] as const
  for (const [organizationId, id, name, role, email] of people)
    await repositories.users.save(
      organizationId,
      createUser({ ...aUser().build(), id, organizationId, name, role, email }),
    )
  const actorSession: ActorSession = { get: () => managerA, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock(NOW),
    boardSettings: repositories.boardSettings,
    checklist: repositories.checklist,
    acceptance: repositories.acceptance,
    comments: repositories.comments,
    contributors: repositories.contributors,
    dailyEntries: repositories.dailyEntries,
    teamTools: repositories.teamTools,
    projectModules: repositories.projectModules,
    projectSetup: repositories.projectSetup,
    guideProgress: repositories.guideProgress,
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
    deliverables: repositories.deliverables,
    milestones: repositories.milestones,
    impediments: repositories.impediments,
    definitionOfDone: repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: repositories.meetings,
    organizations: repositories.organizations,
    participations: repositories.participations,
    projects: repositories.projects,
    retroActions: repositories.retroActions,
    taskOpens: repositories.taskOpens,
    tasks: repositories.tasks,
    timeline: repositories.timeline,
    unitOfWork,
    users: repositories.users,
  })
  return { useCases, unitOfWork }
}

type UseCases = Awaited<ReturnType<typeof setup>>['useCases']

/** Equipe da organização A com tudo desligado exceto o núcleo (`disable` + `finalize`, como em team-tools.test.ts). */
async function teamWithOnlyCore(useCases: UseCases) {
  await useCases.teamTools.applyChange.execute(contextManagerA, {
    disable: NON_CORE_MODULES,
    finalize: NON_CORE_MODULES,
  })
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('esperava uma recusa')
}

describe('projeto Simples: ponta a ponta', () => {
  it('1) equipe só com o núcleo e projeto novo: só o núcleo fica ativo no projeto', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto Simples',
    })

    const view = await useCases.projectModules.get.execute(contextManagerA, {
      projectId: project.id,
    })

    const active = view.modules.filter((module) => module.state === 'active').map((m) => m.id)
    const disabled = view.modules.filter((module) => module.state !== 'active').map((m) => m.id)
    expect(active).toEqual(['core'])
    expect(disabled).toEqual(NON_CORE_MODULES)
  })

  it('2) o fluxo do núcleo funciona: criar, cinco estados na ordem, prazo, envolvidos e linha do tempo', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto Simples',
    })

    const task = await useCases.tasks.create.execute(contextManagerA, {
      projectId: project.id,
      title: 'Tarefa do projeto simples',
      status: 'planning',
      responsibleId: managerAId,
    })
    for (const status of ['todo', 'in_progress', 'review', 'done'] as const)
      await useCases.tasks.move.execute(contextManagerA, { taskId: task.id, status })
    await useCases.tasks.update.execute(contextManagerA, {
      taskId: task.id,
      changes: { deadline: DEADLINE },
    })
    await useCases.participations.add.execute(contextManagerA, {
      taskId: task.id,
      participant: { kind: 'user', userId: collaboratorId },
      role: 'support',
    })

    const detail = await useCases.tasks.getDetail.execute(contextManagerA, { taskId: task.id })
    expect(detail).toMatchObject({ status: 'done', deadline: DEADLINE })

    const timeline = await useCases.timeline.list.execute(contextManagerA, { taskId: task.id })
    const types = timeline.map((event) => event.type)
    expect(types).toEqual(
      expect.arrayContaining([
        'task_created',
        'status_changed',
        'deadline_changed',
        'participant_added',
      ]),
    )
    // Quatro movimentos depois da criação: um evento de status por movimento.
    expect(types.filter((type) => type === 'status_changed')).toHaveLength(4)
    expect(timeline.every((event) => event.asManager)).toBe(true)
  })

  it('3) módulos desligados seguem recusados nessa equipe, com o erro do guard', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto Simples',
    })
    const sprint = {
      projectId: project.id,
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
    }

    const refusals = await Promise.all([
      rejectionOf(useCases.sprints.create.execute(contextManagerA, sprint)),
      rejectionOf(useCases.backlog.list.execute(contextManagerA, { projectId: project.id })),
      rejectionOf(useCases.boardSettings.get.execute(contextManagerA)),
    ])

    for (const error of refusals) {
      expect(error).toBeInstanceOf(PermissionDeniedError)
      expect((error as Error).message).toBe('Esta ferramenta está desativada para a equipe.')
    }
  })

  it('4) ligar um módulo e desligar de novo não perde as tarefas criadas', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto Simples',
    })
    const task = await useCases.tasks.create.execute(contextManagerA, {
      projectId: project.id,
      title: 'Antes de ligar',
      status: 'todo',
    })
    const timelineBefore = await useCases.timeline.list.execute(contextManagerA, {
      taskId: task.id,
    })

    await useCases.projectModules.change.execute(contextManagerA, {
      projectId: project.id,
      enable: ['wip'],
    })
    expect(await projectWipState(useCases, project.id)).toBe('active')

    await useCases.projectModules.change.execute(contextManagerA, {
      projectId: project.id,
      disable: ['wip'],
    })
    expect(await projectWipState(useCases, project.id)).toBe('disabled')

    const detail = await useCases.tasks.getDetail.execute(contextManagerA, { taskId: task.id })
    expect(detail).toMatchObject({ title: 'Antes de ligar', status: 'todo' })
    const timelineAfter = await useCases.timeline.list.execute(contextManagerA, {
      taskId: task.id,
    })
    expect(timelineAfter).toEqual(timelineBefore)
  })
})

async function projectWipState(useCases: UseCases, projectId: string) {
  const view = await useCases.projectModules.get.execute(contextManagerA, { projectId })
  return view.modules.find((module) => module.id === 'wip')?.state
}

/**
 * Módulo por projeto no guard (ADR-10): o projeto decide, a equipe não entra na conta. Com Sprints
 * ligada só na equipe, um projeto sem Sprints recusa a criação de sprint; com Sprints ligada no
 * projeto, ela funciona, mesmo com a equipe desligada.
 */
describe('módulo por projeto no guard', () => {
  const sprintInput = (projectId: string) => ({
    projectId,
    plannedStart: '2026-11-16',
    plannedEnd: '2026-11-27',
  })

  it('projeto com Sprints ligada no projeto cria sprint, com a equipe desligada', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto com sprint',
    })
    await useCases.projectModules.change.execute(contextManagerA, {
      projectId: project.id,
      enable: ['sprints'],
    })

    const created = await useCases.sprints.create.execute(contextManagerA, sprintInput(project.id))

    expect(created.sprint.projectId).toBe(project.id)
  })

  it('projeto sem Sprints recusa criar sprint mesmo com Sprints ligada na equipe', async () => {
    const { useCases } = await setup()
    await teamWithOnlyCore(useCases)
    await useCases.teamTools.applyChange.execute(contextManagerA, { enable: ['sprints'] })
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Projeto Simples',
    })

    await expect(
      useCases.sprints.create.execute(contextManagerA, sprintInput(project.id)),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })
})
