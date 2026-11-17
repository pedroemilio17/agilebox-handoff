import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  PermissionDeniedError,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, ModuleState } from '@agilebox/core'
import type { ChangeProjectModulesInput } from '@agilebox/contract'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const NOW = '2026-11-16T12:00:00.000Z'

const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const collaboratorId = toUserId('00000000000000000000000011')
const managerAId = toUserId('00000000000000000000000012')
const managerBId = toUserId('00000000000000000000000021')
const collaboratorA: Actor = { userId: collaboratorId, organizationId: orgA, role: 'collaborator' }
const managerA: Actor = { userId: managerAId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }
const contextManagerA: TenantContext = createTenantContext(managerA)
const contextCollaboratorA: TenantContext = createTenantContext(collaboratorA)
const contextManagerB: TenantContext = createTenantContext(managerB)

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
    sprints: repositories.sprints,
    sprintTasks: repositories.sprintTasks,
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

/** Projeto da organização A, com a colaboradora como participante. */
async function projectWithCollaborator(useCases: UseCases) {
  const project = await useCases.projects.createProject.execute(contextManagerA, {
    name: 'Projeto',
  })
  await useCases.projects.addMember.execute(contextManagerA, {
    projectId: project.id,
    userId: collaboratorId,
  })
  return project
}

async function change(
  useCases: UseCases,
  projectId: string,
  input: Omit<ChangeProjectModulesInput, 'projectId'>,
) {
  return useCases.projectModules.change.execute(contextManagerA, { projectId, ...input })
}

function statesOf(modules: readonly { id: string; state: ModuleState }[]) {
  return new Map(modules.map((module) => [module.id, module.state]))
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('esperava uma recusa')
}

describe('módulos por projeto: leitura', () => {
  it('colaborador participante vê os módulos, sem o que está gravado virar ligado', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const view = await useCases.projectModules.get.execute(contextCollaboratorA, {
      projectId: project.id,
    })

    expect(view.canManage).toBe(false)
    const states = statesOf(view.modules)
    expect(states.get('core')).toBe('active')
    expect(states.get('sprints')).toBe('disabled')
    expect(view.modules.find((module) => module.id === 'core')).toMatchObject({
      name: 'Núcleo',
      level: null,
      config: null,
    })
  })

  it('projeto de outra organização não aparece para o ator', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(
      useCases.projectModules.get.execute(contextManagerB, { projectId: project.id }),
    )
    expect(error).toMatchObject({ name: 'NotFoundError' })
  })

  it('colaborador que não participa do projeto não lê os módulos', async () => {
    const { useCases } = await setup()
    const project = await useCases.projects.createProject.execute(contextManagerA, {
      name: 'Sem a Ana',
    })

    const error = await rejectionOf(
      useCases.projectModules.get.execute(contextCollaboratorA, { projectId: project.id }),
    )
    expect(error).toBeInstanceOf(PermissionDeniedError)
  })
})

describe('módulos por projeto: alteração', () => {
  it('colaborador vê mas não altera: recusado com PermissionDeniedError', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(
      useCases.projectModules.change.execute(contextCollaboratorA, {
        projectId: project.id,
        enable: ['sprints'],
      }),
    )
    expect(error).toBeInstanceOf(PermissionDeniedError)
  })

  it('gestor liga Sprints e o Backlog vem junto (autoEnabled)', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const result = await change(useCases, project.id, { enable: ['sprints'] })

    expect(result.autoEnabled).toEqual(['backlog'])
    expect(result.scheduled).toEqual([])
    const states = statesOf(result.modules)
    expect(states.get('sprints')).toBe('active')
    expect(states.get('backlog')).toBe('active')
  })

  it('gestor desliga Backlog com Sprints ligado: Sprints vem na cascata', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)
    await change(useCases, project.id, { enable: ['sprints'] })

    const result = await change(useCases, project.id, { disable: ['backlog'] })

    expect(result.cascadeDisabled).toContain('sprints')
    const states = statesOf(result.modules)
    expect(states.get('backlog')).toBe('disabled')
    expect(states.get('sprints')).toBe('disabled')
  })

  it('com sprint ativa, desligar Sprints fica agendado e nada é gravado', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)
    await change(useCases, project.id, { enable: ['sprints'] })
    const sprint = await useCases.sprints.create.execute(contextManagerA, {
      projectId: project.id,
      name: 'Sprint 1',
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
    })
    await useCases.sprints.start.execute(contextManagerA, { sprintId: sprint.sprint.id })

    const result = await change(useCases, project.id, { disable: ['sprints'] })

    expect(result.scheduled).toEqual([{ moduleId: 'sprints', reason: 'active_sprint' }])
    expect(result.cascadeDisabled).toEqual([])
    expect(statesOf(result.modules).get('sprints')).toBe('active')
  })

  it('core nunca é desligado: o pedido é recusado com ValidationError', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(change(useCases, project.id, { disable: ['core'] }))
    expect(error).toBeInstanceOf(ValidationError)
    expect(String((error as Error).message)).toContain('Núcleo')
  })

  it('ferramenta desconhecida é recusada com ValidationError', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(change(useCases, project.id, { enable: ['inexistente'] }))
    expect(error).toBeInstanceOf(ValidationError)
  })

  it('ligar e desligar o mesmo módulo no mesmo pedido é recusado', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(
      change(useCases, project.id, { enable: ['wip'], disable: ['wip'] }),
    )
    expect(error).toBeInstanceOf(ValidationError)
  })

  it('projeto de outra organização é recusado (fronteira de organização)', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const error = await rejectionOf(
      useCases.projectModules.change.execute(contextManagerB, {
        projectId: project.id,
        enable: ['sprints'],
      }),
    )
    expect(error).toMatchObject({ name: 'NotFoundError' })
  })

  it('projeto arquivado recusa a mudança com ValidationError', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)
    await useCases.projects.archive.execute(contextManagerA, { projectId: project.id })

    const error = await rejectionOf(change(useCases, project.id, { enable: ['checkins'] }))
    expect(error).toBeInstanceOf(ValidationError)
  })

  it('desligar não apaga a configuração do módulo', async () => {
    const { useCases, unitOfWork } = await setup()
    const project = await projectWithCollaborator(useCases)
    await change(useCases, project.id, { enable: ['sprints'] })
    await unitOfWork.repositories.projectModules.save(
      orgA,
      toProjectId(project.id),
      [{ moduleId: 'sprints', state: 'active', config: { maxActiveSprints: 3 } }],
      managerAId,
      NOW,
    )

    await change(useCases, project.id, { disable: ['sprints'] })

    const view = await useCases.projectModules.get.execute(contextManagerA, {
      projectId: project.id,
    })
    const sprints = view.modules.find((module) => module.id === 'sprints')
    expect(sprints).toMatchObject({ state: 'disabled', config: { maxActiveSprints: 3 } })
  })

  it('pedido sem mudança real não grava nada', async () => {
    const { useCases } = await setup()
    const project = await projectWithCollaborator(useCases)

    const result = await change(useCases, project.id, { disable: ['wip'] })

    expect(result.cascadeDisabled).toEqual([])
    expect(statesOf(result.modules).get('wip')).toBe('disabled')
  })
})
