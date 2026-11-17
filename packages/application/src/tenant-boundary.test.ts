import { describe, expect, it } from 'vitest'
import { createOrganization, createUser, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createTenantContext } from './tenant-context'
import type { TenantContext } from './tenant-context'
import { createUseCases } from './create-use-cases'
import type { ActorSession } from './ports'
import { aUser } from './testing/builders'
import { FixedClock } from './testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from './testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from './testing/fakes/recording-notifier'
import { SequentialIdGenerator } from './testing/fakes/sequential-id-generator'

const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const collaboratorId = toUserId('00000000000000000000000011')
const managerAId = toUserId('00000000000000000000000012')
const managerBId = toUserId('00000000000000000000000021')
const collaboratorA: Actor = { userId: collaboratorId, organizationId: orgA, role: 'collaborator' }
const managerA: Actor = { userId: managerAId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }

/** Casos de uso que estabelecem a sessão: não há contexto antes deles (ver create-use-cases.ts). */
const sessionUseCases = ['session.getCurrentActor', 'session.switchUser']

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
  await repositories.users.save(
    orgA,
    createUser({ ...aUser().build(), id: collaboratorId, organizationId: orgA, name: 'Ana' }),
  )
  await repositories.users.save(
    orgA,
    createUser({
      ...aUser().build(),
      id: managerAId,
      organizationId: orgA,
      name: 'Gestora A',
      role: 'manager',
      email: 'gestora-a@example.com',
    }),
  )
  await repositories.users.save(
    orgB,
    createUser({
      ...aUser().build(),
      id: managerBId,
      organizationId: orgB,
      name: 'Gestor B',
      role: 'manager',
      email: 'gestor-b@example.com',
    }),
  )
  const actorSession: ActorSession = { get: () => collaboratorA, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock('2026-01-02T12:00:00.000Z'),
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

type UseCaseLike = { execute: (context: unknown, input: unknown) => unknown }

/** Coleta todos os casos de uso registrados (folhas com `execute`) com o caminho até cada um. */
function collectUseCases(node: object, path = ''): Array<[string, UseCaseLike]> {
  return Object.entries(node as Record<string, unknown>).flatMap(
    ([key, value]): Array<[string, UseCaseLike]> => {
      const current = path === '' ? key : `${path}.${key}`
      if (typeof value !== 'object' || value === null) return []
      if ('execute' in value && typeof value.execute === 'function')
        return [[current, value as UseCaseLike]]
      return collectUseCases(value, current)
    },
  )
}

describe('fronteira TenantContext: casos de uso registrados', () => {
  it('todo caso de uso registrado recusa a chamada sem TenantContext', async () => {
    const { useCases } = await setup()
    const registered = collectUseCases(useCases)
    const protectedPaths = registered
      .map(([path]) => path)
      .filter((path) => !sessionUseCases.includes(path))

    expect(registered.map(([path]) => path).filter((p) => sessionUseCases.includes(p))).toEqual(
      sessionUseCases,
    )
    expect(protectedPaths.length).toBeGreaterThan(60)
    for (const [path, useCase] of registered) {
      if (sessionUseCases.includes(path)) continue
      // Ator cru, e contexto cujo time não bate com o do ator: ambos param antes da consulta.
      expect(() => useCase.execute(collaboratorA, undefined), path).toThrow(
        /TenantContext obrigatório/,
      )
      expect(
        () => useCase.execute({ tenantId: orgB, actor: collaboratorA }, undefined),
        path,
      ).toThrow(/TenantContext obrigatório/)
    }
  })

  it('o tipo recusa um Actor cru onde o caso de uso exige o contexto', async () => {
    const { useCases } = await setup()
    // @ts-expect-error - Actor não é TenantContext: a fronteira exige o contexto da sessão
    expect(() => useCases.tasks.listBoard.execute(collaboratorA, {})).toThrow(/TenantContext/)
  })

  it('não devolve dados da organização A para um contexto da organização B', async () => {
    const { useCases } = await setup()
    const contextA: TenantContext = createTenantContext(managerA)
    const contextB: TenantContext = createTenantContext(managerB)
    const project = await useCases.projects.createProject.execute(contextA, {
      name: 'Projeto secreto A',
    })
    // Agenda é do projeto (ADR-10): a organização A liga em um projeto ativo para criar reunião.
    await useCases.projectModules.change.execute(contextA, {
      projectId: project.id,
      enable: ['agenda'],
    })
    const task = await useCases.tasks.create.execute(contextA, {
      projectId: project.id,
      title: 'Tarefa secreta A',
    })
    await useCases.meetings.create.execute(contextA, {
      title: 'Reunião secreta A',
      date: '2026-02-10',
      time: '09:30',
      participants: [collaboratorId],
    })

    // Controle: o contexto da organização A enxerga os próprios dados.
    expect(JSON.stringify(await useCases.projects.listProjects.execute(contextA))).toContain(
      'Projeto secreto A',
    )

    const range = { rangeStart: '2026-02-01', rangeEnd: '2026-02-28' }
    const fromB = [
      await useCases.projects.listProjects.execute(contextB),
      await useCases.tasks.listBoard.execute(contextB, {}),
      await useCases.tasks.search.execute(contextB, { query: 'secreta' }),
      await useCases.dashboard.get.execute(contextB),
      await useCases.meetings.listRange.execute(contextB, range),
      await useCases.meetings.listUpcoming.execute(contextB),
    ]
    const serialized = JSON.stringify(fromB)
    expect(serialized).not.toContain('secreta A')
    expect(serialized).not.toContain(project.id)
    expect(serialized).not.toContain(task.id)

    await expect(useCases.tasks.getDetail.execute(contextB, { taskId: task.id })).rejects.toThrow()
  })
})
