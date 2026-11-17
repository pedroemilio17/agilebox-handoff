import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createUser,
  toEventId,
  toOrganizationId,
  toTaskId,
  toUserId,
  ValidationError,
  PermissionDeniedError,
} from '@agilebox/core'
import type { Actor, ModuleId, ModuleState, TimelineEvent, UserId } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const anaId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000003')
const brunoId = toUserId('00000000000000000000000005')
const otherManagerId = toUserId('00000000000000000000000008')
const ana: Actor = { userId: anaId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const otherManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

const DATE = '2026-11-04'
const TZ = 'America/Sao_Paulo'
const NOON = '2026-11-04T15:00:00.000Z'
const id = (n: number) => String(n).padStart(26, '0')

function setup(actor: Actor = ana, options: { sprints?: unknown } = {}) {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    acceptance: unitOfWork.repositories.acceptance,
    clock: new FixedClock('2026-11-04T15:00:00.000Z'),
    comments: unitOfWork.repositories.comments,
    contributors: unitOfWork.repositories.contributors,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    teamTools: unitOfWork.repositories.teamTools,
    projectModules: unitOfWork.repositories.projectModules,
    projectSetup: unitOfWork.repositories.projectSetup,
    sprints: (options.sprints ??
      unitOfWork.repositories.sprints) as typeof unitOfWork.repositories.sprints,
    sprintTasks: unitOfWork.repositories.sprintTasks,
    impediments: unitOfWork.repositories.impediments,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    retroActions: unitOfWork.repositories.retroActions,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

/** Grava o estado dos módulos da organização (como `teamTools.setModuleConfig`, mas direto no repositório). */
async function saveModules(
  unitOfWork: InMemoryUnitOfWork,
  states: Partial<Record<ModuleId, ModuleState>>,
) {
  const modules = (Object.keys(states) as ModuleId[]).map((moduleId) => ({
    moduleId,
    state: states[moduleId] as ModuleState,
  }))
  await unitOfWork.repositories.teamTools.saveSettings(
    organizationId,
    { level: 'advanced', modules },
    anaId,
    '2026-11-04T15:00:00.000Z',
  )
}

let seq = 0
function event(
  taskId: string,
  at: string,
  type: string,
  payload: object,
  by = anaId,
): TimelineEvent {
  seq += 1
  return {
    id: toEventId(id(500 + seq)),
    taskId,
    at,
    actorUserId: by,
    asManager: false,
    type,
    payload,
  } as unknown as TimelineEvent
}

/** Pessoas, uma tarefa de Ana, uma de Bruno, uma arquivada e uma de backlog de Ana, e uma de outra empresa. */
async function seed(unitOfWork: InMemoryUnitOfWork) {
  const { organizations } = unitOfWork.repositories
  await organizations.save(
    createOrganization({
      id: organizationId,
      name: 'Time A',
      taskPrefix: 'AB',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  )
  await organizations.save(
    createOrganization({
      id: otherOrganizationId,
      name: 'Time B',
      taskPrefix: 'BBB',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  )
  const people: [UserId, string, Actor['role']][] = [
    [managerId, 'Gestor', 'manager'],
    [anaId, 'Ana', 'collaborator'],
    [brunoId, 'Bruno', 'collaborator'],
  ]
  for (const [userId, name, role] of people) {
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name,
        email: `${name.toLowerCase()}@example.com`,
        role,
        defaultRateCents: 4500,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  }
  await unitOfWork.repositories.users.save(
    otherOrganizationId,
    createUser({
      id: otherManagerId,
      organizationId: otherOrganizationId,
      name: 'Outro gestor',
      email: 'outro@example.com',
      role: 'manager',
      defaultRateCents: 4500,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  )
  const anaTask = aTask()
    .with({ id: toTaskId(id(21)), createdBy: anaId, title: 'Relatório', number: 12 })
    .build()
  const brunoTask = aTask()
    .with({ id: toTaskId(id(22)), createdBy: brunoId, title: 'Do Bruno', number: 13 })
    .build()
  const archived = {
    ...aTask()
      .with({ id: toTaskId(id(23)), createdBy: anaId, title: 'Arquivada', number: 14 })
      .build(),
    archivedAt: '2026-11-01T00:00:00.000Z',
    archivedBy: anaId,
  }
  const backlog = {
    ...aTask()
      .with({ id: toTaskId(id(24)), createdBy: anaId, title: 'No backlog', number: 15 })
      .build(),
    backlogRank: 1000,
  }
  for (const task of [anaTask, brunoTask, archived, backlog]) {
    await unitOfWork.repositories.tasks.save(organizationId, task)
  }
  const foreign = aTask()
    .with({ id: toTaskId(id(25)), createdBy: otherManagerId, title: 'Outra empresa', number: 16 })
    .build()
  await unitOfWork.repositories.tasks.save(otherOrganizationId, {
    ...foreign,
    organizationId: otherOrganizationId,
  })
  return { anaTask, brunoTask, archived, backlog, foreign }
}

describe('daily.suggestSummary: resumo a partir das tarefas movidas', () => {
  it('lista só as tarefas de que a pessoa participa, movidas e com horas no dia', async () => {
    const { useCases, unitOfWork } = setup()
    const fx = await seed(unitOfWork)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.anaTask.id, NOON, 'status_changed', { before: 'todo', after: 'review' }),
      event(fx.anaTask.id, NOON, 'hours_changed', {
        participant: { kind: 'user', userId: anaId },
        before: 0,
        after: 150,
      }),
      event(fx.brunoTask.id, NOON, 'status_changed', { before: 'todo', after: 'done' }),
      event(fx.archived.id, NOON, 'status_changed', { before: 'todo', after: 'done' }),
      event(fx.backlog.id, NOON, 'status_changed', { before: 'todo', after: 'done' }),
    ])

    const result = await useCases.daily.suggestSummary.execute(createTenantContext(ana), {
      date: DATE,
      timeZone: TZ,
    })

    expect(result).toEqual({
      advanced: ['AB-12 Relatório: foi para Revisar · lançou 1,5 h'],
      nextCandidates: [],
      blockers: [],
    })
  })

  it('dia sem eventos devolve listas vazias', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.daily.suggestSummary.execute(createTenantContext(ana), { date: DATE, timeZone: TZ }),
    ).resolves.toEqual({ advanced: [], nextCandidates: [], blockers: [] })
  })

  it('a virada de dia usa o fuso recebido do cliente', async () => {
    const { useCases, unitOfWork } = setup()
    const fx = await seed(unitOfWork)
    // 02:30 UTC de 4/11 é 23:30 de 3/11 em São Paulo.
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.anaTask.id, '2026-11-04T02:30:00.000Z', 'status_changed', {
        before: 'todo',
        after: 'review',
      }),
    ])
    const context = createTenantContext(ana)
    const sp = await useCases.daily.suggestSummary.execute(context, { date: DATE, timeZone: TZ })
    const utc = await useCases.daily.suggestSummary.execute(context, {
      date: DATE,
      timeZone: 'UTC',
    })
    expect(sp.advanced).toEqual([])
    expect(utc.advanced).toEqual(['AB-12 Relatório: foi para Revisar'])
  })

  it('data inválida e fuso inválido são recusados', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const context = createTenantContext(ana)
    await expect(
      useCases.daily.suggestSummary.execute(context, { date: '04/11/2026', timeZone: TZ }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.daily.suggestSummary.execute(context, { date: DATE, timeZone: 'Marte/Olympus' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('gestor vê só as tarefas em que participa, não as do time', async () => {
    const { useCases, unitOfWork } = setup(manager)
    const fx = await seed(unitOfWork)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.brunoTask.id, NOON, 'status_changed', { before: 'todo', after: 'review' }, brunoId),
    ])
    await expect(
      useCases.daily.suggestSummary.execute(createTenantContext(manager), {
        date: DATE,
        timeZone: TZ,
      }),
    ).resolves.toEqual({ advanced: [], nextCandidates: [], blockers: [] })
  })

  it('isolamento por organização: a sugestão de outra empresa não vê tarefas daqui', async () => {
    const { useCases, unitOfWork } = setup(otherManager)
    const fx = await seed(unitOfWork)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.anaTask.id, NOON, 'status_changed', { before: 'todo', after: 'review' }),
    ])
    await expect(
      useCases.daily.suggestSummary.execute(createTenantContext(otherManager), {
        date: DATE,
        timeZone: TZ,
      }),
    ).resolves.toEqual({ advanced: [], nextCandidates: [], blockers: [] })
  })

  it('sem sprints e sem backlog o resumo funciona e nunca toca o repositório de sprints', async () => {
    const touched = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('sprint lida pelo check-in')
        },
      },
    )
    const { useCases, unitOfWork } = setup(ana, { sprints: touched })
    const fx = await seed(unitOfWork)
    // Ferramentas que dependem de sprint e de backlog também saem, para o conjunto ser válido.
    await saveModules(unitOfWork, {
      sprints: 'disabled',
      backlog: 'disabled',
      reviewRetro: 'disabled',
      burndown: 'disabled',
      checkins: 'active',
    })
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.anaTask.id, NOON, 'status_changed', { before: 'todo', after: 'review' }),
    ])
    await expect(
      useCases.daily.suggestSummary.execute(createTenantContext(ana), { date: DATE, timeZone: TZ }),
    ).resolves.toMatchObject({ advanced: ['AB-12 Relatório: foi para Revisar'] })
  })

  it('check-ins desligado recusa a sugestão; encerrando segue permitida (só leitura)', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const context = createTenantContext(ana)
    await saveModules(unitOfWork, { checkins: 'disabled' })
    await expect(
      useCases.daily.suggestSummary.execute(context, { date: DATE, timeZone: TZ }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)

    await saveModules(unitOfWork, { checkins: 'winding_down' })
    await expect(
      useCases.daily.suggestSummary.execute(context, { date: DATE, timeZone: TZ }),
    ).resolves.toBeDefined()
  })
})

describe('daily.suggestSummary: textos de próximo passo e bloqueio', () => {
  it('comentário próprio em tarefa aberta e bloqueio do dia aparecem nas listas certas', async () => {
    const { useCases, unitOfWork } = setup()
    const fx = await seed(unitOfWork)
    await unitOfWork.repositories.timeline.saveMany(organizationId, [
      event(fx.anaTask.id, NOON, 'comment_added', { commentId: id(77), excerpt: 'oi' }),
      event(fx.anaTask.id, '2026-11-04T16:00:00.000Z', 'blocked', { reason: 'Sem acesso' }),
    ])
    const result = await useCases.daily.suggestSummary.execute(createTenantContext(ana), {
      date: DATE,
      timeZone: TZ,
    })
    expect(result.blockers).toEqual(['AB-12 Relatório: bloqueada (Sem acesso)'])
    // Bloqueada hoje: não entra como próximo passo.
    expect(result.nextCandidates).toEqual([])
  })
})
