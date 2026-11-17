import { createTenantContext } from '../tenant-context'
import type { TenantContext } from '../tenant-context'
import {
  createOrganization,
  createParticipation,
  DEFAULT_TEAM_MODULE_IDS,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type {
  Actor,
  ModuleId,
  ModuleState,
  OrganizationId,
  ProjectId,
  UserId,
} from '@agilebox/core'
import { createUseCases } from '../create-use-cases'
import type { ActorSession } from '../ports'
import { aProject, aTask, aUser } from './builders'
import { FixedClock } from './fakes/fixed-clock'
import { InMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import { RecordingNotifier } from './fakes/recording-notifier'
import { SequentialIdGenerator } from './fakes/sequential-id-generator'

/**
 * Harness de testes de tarefa (M3.2): organização A com ana (Responsável), bia (Apoio, 2 h),
 * carla (fora da tarefa), gestora e uma tarefa de ana. Organização B com uma gestora e nada mais.
 * Só para os testes de `acceptance` e `estimates`; não é exportado pelo índice de testes.
 */
export const NOW = '2026-01-02T12:00:00.000Z'
export const orgA = toOrganizationId('00000000000000000000000001')
export const orgB = toOrganizationId('00000000000000000000000009')
export const anaId = toUserId('00000000000000000000000002')
export const biaId = toUserId('00000000000000000000000003')
export const managerId = toUserId('00000000000000000000000004')
export const carlaId = toUserId('00000000000000000000000005')
export const otherManagerId = toUserId('00000000000000000000000008')
export const projectId = toProjectId('00000000000000000000000006')
export const taskId = toTaskId('00000000000000000000000007')

export const ana: Actor = { userId: anaId, organizationId: orgA, role: 'collaborator' }
export const bia: Actor = { userId: biaId, organizationId: orgA, role: 'collaborator' }
export const carla: Actor = { userId: carlaId, organizationId: orgA, role: 'collaborator' }
export const manager: Actor = { userId: managerId, organizationId: orgA, role: 'manager' }
export const otherManager: Actor = { userId: otherManagerId, organizationId: orgB, role: 'manager' }

export function ctx(actor: Actor): TenantContext {
  return createTenantContext(actor)
}

export function createTaskHarness(initial: Actor = ana) {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  let current = initial
  const actorSession: ActorSession = { get: () => current, set: (actor) => (current = actor) }
  const useCases = createUseCases({
    actorSession,
    acceptance: unitOfWork.repositories.acceptance,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    clock: new FixedClock(NOW),
    comments: unitOfWork.repositories.comments,
    contributors: unitOfWork.repositories.contributors,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    retroActions: unitOfWork.repositories.retroActions,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    teamTools: unitOfWork.repositories.teamTools,
    projectModules: unitOfWork.repositories.projectModules,
    sprints: unitOfWork.repositories.sprints,
    sprintTasks: unitOfWork.repositories.sprintTasks,
    impediments: unitOfWork.repositories.impediments,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

export interface SeedOptions {
  /** Valor/hora do envolvimento do Responsável (ana). 0 = sem valor, cai no padrão do usuário. */
  readonly responsibleRateCents?: number
  /** Padrão de valor/hora da ana (usuário). */
  readonly anaDefaultRateCents?: number
  /** Estimativa inicial em centésimos de hora (null = sem estimativa). */
  readonly estimatedHoursHundredths?: number | null
  readonly archived?: boolean
  /**
   * Módulos ligados no projeto da fixture (ADR-10: o guard lê o projeto). Padrão: as ferramentas que
   * a equipe trazia ligadas por padrão, para que os testes partam do mesmo ponto de antes.
   */
  readonly projectModules?: readonly ModuleId[]
}

/** Grava organizações, usuários, projeto e a tarefa de ana, com Apoio de bia (2 h, 30,00 de valor/hora). */
export async function seedTaskHarness(
  unitOfWork: InMemoryUnitOfWork,
  options: SeedOptions = {},
): Promise<void> {
  const repositories = unitOfWork.repositories
  await repositories.organizations.save(
    createOrganization({ id: orgA, name: 'Time A', createdAt: '2026-01-01T00:00:00.000Z' }),
  )
  await repositories.organizations.save(
    createOrganization({ id: orgB, name: 'Time B', createdAt: '2026-01-01T00:00:00.000Z' }),
  )
  const users = [
    aUser()
      .with({
        id: anaId,
        organizationId: orgA,
        name: 'Ana',
        email: 'ana@example.com',
        defaultRateCents: options.anaDefaultRateCents ?? 4500,
      })
      .build(),
    aUser()
      .with({
        id: biaId,
        organizationId: orgA,
        name: 'Bia',
        email: 'bia@example.com',
        defaultRateCents: 3000,
      })
      .build(),
    aUser()
      .with({
        id: carlaId,
        organizationId: orgA,
        name: 'Carla',
        email: 'carla@example.com',
        defaultRateCents: 2000,
      })
      .build(),
    aUser()
      .with({
        id: managerId,
        organizationId: orgA,
        name: 'Gestora',
        email: 'gestora@example.com',
        role: 'manager',
        defaultRateCents: 6000,
      })
      .build(),
    aUser()
      .with({
        id: otherManagerId,
        organizationId: orgB,
        name: 'Gestora B',
        email: 'gb@example.com',
        role: 'manager',
      })
      .build(),
  ]
  for (const user of users) await repositories.users.save(user.organizationId, user)
  const project = aProject()
    .with({ id: projectId, organizationId: orgA, createdBy: managerId, name: 'Projeto' })
    .build()
  await repositories.projects.save(orgA, project)
  const base = aTask()
    .inProject(project)
    .ownedBy(aUser().with({ id: anaId, organizationId: orgA }).build())
    .with({
      id: taskId,
      organizationId: orgA,
      number: 1,
      responsibleParticipationId: toParticipationId('00000000000000000000000010'),
      responsibleRateCents: options.responsibleRateCents ?? 4500,
    })
    .build()
  const withSupport = {
    ...base,
    estimatedHoursHundredths: options.estimatedHoursHundredths ?? null,
    archivedAt: options.archived ? '2026-01-01T12:00:00.000Z' : null,
    archivedBy: options.archived ? anaId : null,
    participations: [
      ...base.participations,
      createParticipation({
        id: toParticipationId('00000000000000000000000011'),
        taskId,
        participant: { kind: 'user', userId: biaId },
        role: 'support',
        hoursHundredths: 200,
        rateCents: 3000,
        addedAt: '2026-01-01T00:00:00.000Z',
      }),
    ],
  }
  await repositories.tasks.save(orgA, withSupport)
  await enableProjectModules(
    unitOfWork,
    orgA,
    projectId,
    managerId,
    options.projectModules ?? DEFAULT_TEAM_MODULE_IDS,
  )
}

/** Estado de ferramentas da equipe (gestor). Só a gestão da equipe lê isso; o guard não lê mais (ADR-10). */
export async function setModules(
  unitOfWork: InMemoryUnitOfWork,
  organizationId: OrganizationId,
  actorId: UserId,
  states: Partial<Record<ModuleId, ModuleState>>,
): Promise<void> {
  const modules = (Object.keys(states) as ModuleId[]).map((moduleId) => ({
    moduleId,
    state: states[moduleId] as ModuleState,
  }))
  await unitOfWork.repositories.teamTools.saveSettings(
    organizationId,
    { level: 'advanced', modules },
    actorId,
    NOW,
  )
}

/**
 * Estado de módulos de um projeto (ADR-10): é o que o guard lê. Módulo não citado fica como está;
 * sem linha conta como desligado. Grava direto no repositório, sem resolver dependências (para isso,
 * `projectModules.change`).
 */
export async function setProjectModules(
  unitOfWork: InMemoryUnitOfWork,
  organizationId: OrganizationId,
  projectId: ProjectId,
  actorId: UserId,
  states: Partial<Record<ModuleId, ModuleState>>,
): Promise<void> {
  const changes = (Object.keys(states) as ModuleId[]).map((moduleId) => ({
    moduleId,
    state: states[moduleId] as ModuleState,
  }))
  await unitOfWork.repositories.projectModules.save(
    organizationId,
    projectId,
    changes,
    actorId,
    NOW,
  )
}

/** Liga, no projeto, os módulos pedidos (estado `active`). */
export async function enableProjectModules(
  unitOfWork: InMemoryUnitOfWork,
  organizationId: OrganizationId,
  projectId: ProjectId,
  actorId: UserId,
  moduleIds: readonly ModuleId[],
): Promise<void> {
  await setProjectModules(
    unitOfWork,
    organizationId,
    projectId,
    actorId,
    Object.fromEntries(moduleIds.map((id) => [id, 'active' as const])),
  )
}
