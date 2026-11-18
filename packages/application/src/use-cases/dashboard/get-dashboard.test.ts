import { createTenantContext } from '../../tenant-context'
import { describe, expect, it } from 'vitest'
import { createUser, toOrganizationId, toTaskId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const userId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000004')
const otherManagerId = toUserId('00000000000000000000000005')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const otherManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

const FLOW_KEYS = ['upToDatePercentage', 'cycleDays', 'leadDays', 'throughput', 'weeks'] as const

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
    guideProgress: unitOfWork.repositories.guideProgress,
    sprints: unitOfWork.repositories.sprints,
    sprintTasks: unitOfWork.repositories.sprintTasks,
    deliverables: unitOfWork.repositories.deliverables,
    taskDependencies: unitOfWork.repositories.taskDependencies,
    milestones: unitOfWork.repositories.milestones,
    risks: unitOfWork.repositories.risks,
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

async function seed(unitOfWork: InMemoryUnitOfWork) {
  const project = aProject().build()
  const task = {
    ...aTask().inProject(project).build(),
    status: 'review' as const,
    createdBy: userId,
  }
  await unitOfWork.repositories.users.save(organizationId, aUser().build())
  await unitOfWork.repositories.users.save(
    organizationId,
    createUser({ ...aUser().with({ id: managerId, name: 'Gestor' }).build(), role: 'manager' }),
  )
  await unitOfWork.repositories.tasks.save(organizationId, task)
  await unitOfWork.repositories.tasks.save(organizationId, {
    ...task,
    id: toTaskId('00000000000000000000000030'),
    status: 'done' as const,
  })
  await unitOfWork.repositories.users.save(
    otherOrganizationId,
    createUser({
      ...aUser().with({ id: otherManagerId, name: 'Outra gestora' }).build(),
      role: 'manager',
    }),
  )
}

describe('dashboard.get com a ferramenta de fluxo', () => {
  it('com flowMetrics ativo (padrão), traz os indicadores de fluxo e as seis semanas', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const dashboard = await useCases.dashboard.get.execute(createTenantContext(manager))
    const insights = dashboard.insights!
    for (const key of FLOW_KEYS) expect(insights).toHaveProperty(key)
    expect(insights.weeks).toHaveLength(6)
    expect(insights.weekStart).toBe(insights.weeks![5]!.start)
  })

  it('com flowMetrics desligado, não traz nem calcula o fluxo, e o resto segue igual', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const before = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    await useCases.teamTools.applyChange.execute(createTenantContext(manager), {
      disable: ['flowMetrics'],
      finalize: ['flowMetrics'],
    })
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    for (const key of FLOW_KEYS) expect(insights).not.toHaveProperty(key)
    expect(insights.agingCount).toBe(before.agingCount)
    expect(insights.overdueCount).toBe(before.overdueCount)
    expect(insights.blockedCount).toBe(before.blockedCount)
    expect(insights.overWipColumns).toEqual(before.overWipColumns)
    expect(insights.team).toEqual(before.team)
    expect(insights.recentChanges).toEqual(before.recentChanges)
  })

  it('com flowMetrics encerrando (winding_down), continua trazendo o fluxo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.teamTools.applyChange.execute(createTenantContext(manager), {
      disable: ['flowMetrics'],
    })
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    for (const key of FLOW_KEYS) expect(insights).toHaveProperty(key)
    expect(insights.weeks).toHaveLength(6)
  })

  it('o desligamento vale só para a organização que o fez', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.teamTools.applyChange.execute(createTenantContext(otherManager), {
      disable: ['flowMetrics'],
      finalize: ['flowMetrics'],
    })
    const mine = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    const theirs = (await useCases.dashboard.get.execute(createTenantContext(otherManager)))
      .insights!
    expect(mine.weeks).toHaveLength(6)
    expect(theirs).not.toHaveProperty('weeks')
  })
})

describe('dashboard.exportSummary com a ferramenta de fluxo desligada', () => {
  it('o resumo exportado omite as seções de adesão e de fluxo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.teamTools.applyChange.execute(createTenantContext(manager), {
      disable: ['flowMetrics'],
      finalize: ['flowMetrics'],
    })
    const md = await useCases.dashboard.exportSummary.execute(createTenantContext(manager), {
      period: '2026-01-05',
      format: 'md',
    })
    expect(md.content).not.toContain('## Adesão')
    expect(md.content).not.toContain('## Fluxo semanal')
    expect(md.content).not.toContain('Quadro em dia:')
    expect(md.content).toContain('## Exceções')
    expect(md.content).toContain('## Equipe')
    const csv = await useCases.dashboard.exportSummary.execute(createTenantContext(manager), {
      period: '2026-01-05',
      format: 'csv',
    })
    expect(csv.content).toContain('Nome')
  })

  it('com o fluxo ativo, o resumo continua trazendo as seções de fluxo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const insights = (await useCases.dashboard.get.execute(createTenantContext(manager))).insights!
    const md = await useCases.dashboard.exportSummary.execute(createTenantContext(manager), {
      period: insights.weeks![5]!.start,
      format: 'md',
    })
    expect(md.content).toContain('## Adesão')
    expect(md.content).toContain('## Fluxo semanal')
  })
})
