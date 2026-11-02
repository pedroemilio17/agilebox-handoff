import { describe, expect, it, vi } from 'vitest'
import {
  addParticipant,
  createParticipation,
  createTenantContext,
  createUser,
  PermissionDeniedError,
  NotFoundError,
  sendToBacklog,
  setArchivedAt,
  setStatus,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  ModuleState,
  OrganizationId,
  ProjectId,
  Task,
  TaskStatus,
  UserId,
} from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { UnitOfWorkRepositories } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const managerId = toUserId('00000000000000000000000003')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000004')
const otherManagerId = toUserId('00000000000000000000000008')
const projectId = toProjectId('00000000000000000000000010')
const otherProjectId = toProjectId('00000000000000000000000011')
const otherOrgProjectId = toProjectId('00000000000000000000000012')
const now = '2026-01-20T12:00:00.000Z'
const timestamp = '2026-01-01T00:00:00.000Z'

const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const collaborator: Actor = { userId, organizationId, role: 'collaborator' }
const otherManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

/** Par (contexto, ator) para chamar os casos de uso com o ator dado. */
const call = (actor: Actor) => [createTenantContext(actor), actor] as const

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const useCases = createUseCases({
    actorSession: { get: () => collaborator, set: () => undefined },
    changeNotifier: notifier,
    clock: new FixedClock(now),
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
  return { useCases, unitOfWork, notifier, repos: unitOfWork.repositories }
}

async function setBacklogState(
  repos: UnitOfWorkRepositories,
  org: OrganizationId,
  state: ModuleState,
): Promise<void> {
  await repos.teamModules.save(org, {
    moduleId: 'backlog',
    state,
    config: {},
    changedBy: managerId,
    changedAt: timestamp,
  })
}

/** Tarefa de teste com ids previsíveis. `n` começa em 500 para não colidir com os ids sequenciais. */
interface SeedTask {
  readonly n: number
  readonly createdBy?: UserId
  readonly organization?: OrganizationId
  readonly project?: ProjectId
  readonly rank?: number
  readonly status?: TaskStatus
  readonly archived?: boolean
}

function aSeedTask({
  n,
  createdBy = userId,
  organization = organizationId,
  project = projectId,
  rank,
  status,
  archived = false,
}: SeedTask): Task {
  let task = aTask()
    .with({
      id: toTaskId(String(n).padStart(26, '0')),
      organizationId: organization,
      projectId: project,
      createdBy,
      title: `Tarefa ${n}`,
      responsibleParticipationId: toParticipationId(String(n * 10 + 7).padStart(26, '0')),
    })
    .build()
  if (status !== undefined) task = setStatus(task, status)
  if (rank !== undefined) task = sendToBacklog(task, rank)
  if (archived) task = setArchivedAt(task, timestamp)
  return task
}

/** Gestor de teste: o builder `aUser` só monta colaboradores, então o papel entra por `createUser`. */
function aManager(id: UserId, org: OrganizationId, name: string, email: string) {
  return createUser({
    id,
    organizationId: org,
    name,
    email,
    role: 'manager',
    defaultRateCents: 4500,
    createdAt: timestamp,
  })
}

/** `backlogState: null` deixa o módulo nunca gravado no time (nenhuma linha em `teamModules`). */
async function seedTeam(
  repos: UnitOfWorkRepositories,
  backlogState: ModuleState | null = 'active',
) {
  await repos.users.save(
    organizationId,
    aManager(managerId, organizationId, 'Bia Gestora', 'bia@example.com'),
  )
  await repos.users.save(organizationId, aUser().with({ id: userId, name: 'Ana Silva' }).build())
  await repos.users.save(
    organizationId,
    aUser().with({ id: otherUserId, name: 'Bruno', email: 'bruno@example.com' }).build(),
  )
  await repos.projects.save(organizationId, aProject().with({ id: projectId }).build())
  await repos.projects.save(
    organizationId,
    aProject().with({ id: otherProjectId, name: 'Projeto B' }).build(),
  )
  for (const project of [projectId, otherProjectId]) {
    for (const member of [userId, otherUserId]) {
      await repos.projects.addMember(organizationId, {
        projectId: project,
        userId: member,
        addedBy: managerId,
        addedAt: timestamp,
      })
    }
  }
  if (backlogState !== null) await setBacklogState(repos, organizationId, backlogState)
}

async function seedOtherOrganization(repos: UnitOfWorkRepositories) {
  await repos.users.save(
    otherOrganizationId,
    aManager(otherManagerId, otherOrganizationId, 'Carla', 'carla@example.com'),
  )
  await repos.projects.save(
    otherOrganizationId,
    aProject()
      .with({ id: otherOrgProjectId, organizationId: otherOrganizationId, name: 'Projeto Externo' })
      .build(),
  )
  await setBacklogState(repos, otherOrganizationId, 'active')
}

async function backlogOrder(repos: UnitOfWorkRepositories, org = organizationId) {
  return (await repos.tasks.listBacklog(org)).map((task) => [task.id, task.backlogRank])
}

describe('backlog: listar a ordem do time', () => {
  it('lista pela posição e deixa de fora as tarefas do quadro e as arquivadas', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    const second = aSeedTask({ n: 502, rank: 2 })
    const first = aSeedTask({ n: 501, rank: 1 })
    await repos.tasks.save(organizationId, second)
    await repos.tasks.save(organizationId, first)
    await repos.tasks.save(organizationId, aSeedTask({ n: 503 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 504, rank: 3, archived: true }))

    const listed = await useCases.backlog.list.execute(...call(manager), {})

    expect(listed.map((task) => task.id)).toEqual([first.id, second.id])
  })

  it('colaborador vê só as tarefas de que participa, como na Equipe; gestor vê todas', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    const mine = aSeedTask({ n: 501, rank: 1 })
    const supported = addParticipant(
      aSeedTask({ n: 502, createdBy: otherUserId, rank: 2 }),
      createParticipation({
        id: toParticipationId(String(5020 + 8).padStart(26, '0')),
        taskId: toTaskId(String(502).padStart(26, '0')),
        participant: { kind: 'user', userId },
        role: 'support',
        hoursHundredths: 0,
        rateCents: 4500,
        addedAt: timestamp,
      }),
    )
    const notMine = aSeedTask({ n: 503, createdBy: otherUserId, rank: 3 })
    for (const task of [mine, supported, notMine]) await repos.tasks.save(organizationId, task)

    const asCollaborator = await useCases.backlog.list.execute(...call(collaborator), {})
    const asManager = await useCases.backlog.list.execute(...call(manager), {})

    expect(asCollaborator.map((task) => task.id)).toEqual([mine.id, supported.id])
    expect(asManager.map((task) => task.id)).toEqual([mine.id, supported.id, notMine.id])
  })

  it('filtra por projeto mantendo a ordem', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    const inA = aSeedTask({ n: 501, rank: 1 })
    const inB = aSeedTask({ n: 502, rank: 2, project: otherProjectId })
    const inA2 = aSeedTask({ n: 503, rank: 3 })
    for (const task of [inA, inB, inA2]) await repos.tasks.save(organizationId, task)

    const onlyB = await useCases.backlog.list.execute(...call(manager), {
      projectId: otherProjectId,
    })

    expect(onlyB.map((task) => task.id)).toEqual([inB.id])
  })

  it('não traz tarefas de outro time, nem para o gestor', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await seedOtherOrganization(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await repos.tasks.save(
      otherOrganizationId,
      aSeedTask({
        n: 601,
        organization: otherOrganizationId,
        project: otherOrgProjectId,
        createdBy: otherManagerId,
        rank: 1,
      }),
    )

    const listed = await useCases.backlog.list.execute(...call(manager), {})

    expect(listed.map((task) => task.id)).toEqual([String(501).padStart(26, '0')])
  })

  it('recusa contexto de outro time antes de ler', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)

    await expect(
      useCases.backlog.list.execute(createTenantContext(otherManager), manager, {}),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('com o módulo Backlog desativado, recusa citando o módulo', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await setBacklogState(repos, organizationId, 'disabled')

    await expect(useCases.backlog.list.execute(...call(manager), {})).rejects.toThrow(
      ValidationError,
    )
    await expect(useCases.backlog.list.execute(...call(manager), {})).rejects.toThrow(/Backlog/)
  })

  it('com o módulo Backlog encerrando, ainda lista', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await setBacklogState(repos, organizationId, 'winding_down')

    await expect(useCases.backlog.list.execute(...call(manager), {})).resolves.toHaveLength(1)
  })
})

describe('backlog: reordenar (só gestor, B3 A)', () => {
  async function seedFour(repos: UnitOfWorkRepositories) {
    await seedTeam(repos)
    const tasks = [501, 502, 503, 504].map((n, index) => aSeedTask({ n, rank: index + 1 }))
    for (const task of tasks) await repos.tasks.save(organizationId, task)
    return tasks.map((task) => task.id)
  }

  it('recusa colaborador, mesmo participante, e nenhuma posição muda', async () => {
    const { useCases, repos, notifier } = setup()
    const [a, b] = await seedFour(repos)
    const before = await backlogOrder(repos)

    await expect(
      useCases.backlog.reorder.execute(...call(collaborator), { taskId: a!, placement: 'top' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.backlog.reorder.execute(...call(collaborator), { taskId: b!, placement: 'end' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(notifier.changes).toEqual([])
  })

  it('gestor leva ao topo, ao fim e a um índice, sempre com posições contíguas de 1 a n', async () => {
    const { useCases, repos } = setup()
    const [a, b, c, d] = await seedFour(repos)

    await useCases.backlog.reorder.execute(...call(manager), { taskId: c!, placement: 'top' })
    expect(await backlogOrder(repos)).toEqual([
      [c, 1],
      [a, 2],
      [b, 3],
      [d, 4],
    ])

    await useCases.backlog.reorder.execute(...call(manager), { taskId: c!, placement: 'end' })
    expect(await backlogOrder(repos)).toEqual([
      [a, 1],
      [b, 2],
      [d, 3],
      [c, 4],
    ])

    await useCases.backlog.reorder.execute(...call(manager), { taskId: d!, placement: 1 })
    expect(await backlogOrder(repos)).toEqual([
      [a, 1],
      [d, 2],
      [b, 3],
      [c, 4],
    ])
  })

  it('grava só as posições que mudaram e avisa só essas tarefas', async () => {
    const { useCases, repos, notifier } = setup()
    const [a, b, c] = await seedFour(repos).then(([x, y, z]) => [x, y, z])
    await repos.tasks.save(organizationId, aSeedTask({ n: 505, rank: 5 }))
    const beforeLast = await repos.tasks.findById(organizationId, c!)

    // Move `a` do topo para a posição 1: só `b` e `a` mudam; `c` e os demais ficam como estavam.
    await useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 1 })

    expect(notifier.changes).toEqual([{ organizationId, change: { kind: 'task', ids: [b, a] } }])
    expect(await repos.tasks.findById(organizationId, c!)).toEqual(beforeLast)
  })

  it('não grava nem avisa quando a tarefa já está na posição pedida', async () => {
    const { useCases, repos, notifier } = setup()
    const [a] = await seedFour(repos)

    await useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 'top' })

    expect(notifier.changes).toEqual([])
  })

  it('não cria evento na linha do tempo: reordenar não é edição da tarefa (Q1)', async () => {
    const { useCases, repos } = setup()
    const [a] = await seedFour(repos)

    await useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 'end' })

    await expect(repos.timeline.listByTask(organizationId, a!)).resolves.toEqual([])
  })

  it('posição fora do backlog recusa sem gravar nada', async () => {
    const { useCases, repos, notifier } = setup()
    const [a] = await seedFour(repos)
    const before = await backlogOrder(repos)

    await expect(
      useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 9 }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: -1 }),
    ).rejects.toBeInstanceOf(ValidationError)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(notifier.changes).toEqual([])
  })

  it('tarefa que não está no backlog recusa', async () => {
    const { useCases, repos } = setup()
    await seedFour(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 510 }))

    await expect(
      useCases.backlog.reorder.execute(...call(manager), {
        taskId: String(510).padStart(26, '0'),
        placement: 'top',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('lote atômico: falha no meio da gravação não aplica nenhuma posição', async () => {
    const { useCases, unitOfWork, repos } = setup()
    const [a] = await seedFour(repos)
    const before = await backlogOrder(repos)
    const original = repos.tasks.saveBacklogRanks.bind(repos.tasks)
    // Simula falha depois da primeira alteração do lote: a transação precisa desfazer tudo.
    vi.spyOn(unitOfWork.repositories.tasks, 'saveBacklogRanks').mockImplementationOnce(
      async (org, changes) => {
        await original(org, changes.slice(0, 1))
        throw new Error('falha no meio do lote')
      },
    )

    await expect(
      useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 'end' }),
    ).rejects.toThrow('falha no meio do lote')

    await expect(backlogOrder(repos)).resolves.toEqual(before)
  })

  it('gestor de outro time não reordena tarefa deste time', async () => {
    const { useCases, repos, notifier } = setup()
    const [a] = await seedFour(repos)
    await seedOtherOrganization(repos)
    const before = await backlogOrder(repos)

    await expect(
      useCases.backlog.reorder.execute(...call(otherManager), { taskId: a!, placement: 'end' }),
    ).rejects.toBeInstanceOf(NotFoundError)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(notifier.changes).toEqual([])
  })

  it('tarefa arquivada no backlog recusa com a mesma mensagem de levar ao quadro e não grava', async () => {
    const { useCases, repos, notifier } = setup()
    const [a] = await seedFour(repos)
    const archived = setArchivedAt((await repos.tasks.findById(organizationId, a!))!, timestamp)
    await repos.tasks.save(organizationId, archived)
    const before = await backlogOrder(repos)

    await expect(
      useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 'end' }),
    ).rejects.toThrow(/arquivada/)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(notifier.changes).toEqual([])
  })

  it('contexto de outro time com ator deste time recusa antes de ler', async () => {
    const { useCases, repos } = setup()
    const [a] = await seedFour(repos)

    await expect(
      useCases.backlog.reorder.execute(createTenantContext(otherManager), manager, {
        taskId: a!,
        placement: 'top',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('com o módulo Backlog desativado, recusa citando o módulo e não grava', async () => {
    const { useCases, repos } = setup()
    const [a] = await seedFour(repos)
    await setBacklogState(repos, organizationId, 'disabled')
    const before = await backlogOrder(repos)

    await expect(
      useCases.backlog.reorder.execute(...call(manager), { taskId: a!, placement: 'end' }),
    ).rejects.toThrow(/Backlog/)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
  })
})

describe('backlog: levar ao quadro (Q3: quem edita a tarefa)', () => {
  async function seedBacklogOfThree(repos: UnitOfWorkRepositories) {
    await seedTeam(repos)
    const tasks = [
      aSeedTask({ n: 501, rank: 1 }),
      aSeedTask({ n: 502, rank: 2, status: 'todo' }),
      aSeedTask({ n: 503, rank: 3, createdBy: otherUserId, status: 'review' }),
    ]
    for (const task of tasks) await repos.tasks.save(organizationId, task)
    return tasks.map((task) => task.id)
  }

  it('quem criou a tarefa leva ao quadro: entra em Planejamento e as outras são renumeradas', async () => {
    const { useCases, repos, notifier } = setup()
    const [a, b, c] = await seedBacklogOfThree(repos)

    const taken = await useCases.backlog.takeToBoard.execute(...call(collaborator), {
      taskId: b!,
    })

    expect(taken).toMatchObject({ id: b, status: 'planning' })
    const saved = await repos.tasks.findById(organizationId, b!)
    expect(saved).toMatchObject({ backlogRank: null, onBoard: true, status: 'planning' })
    expect(await backlogOrder(repos)).toEqual([
      [a, 1],
      [c, 2],
    ])
    expect(notifier.changes).toEqual([{ organizationId, change: { kind: 'task', ids: [b, c] } }])
  })

  it('a mudança de estado e a ida ao quadro saem na linha do tempo, sem marca de gestor quando é o próprio', async () => {
    const { useCases, repos } = setup()
    const [, b] = await seedBacklogOfThree(repos)

    await useCases.backlog.takeToBoard.execute(...call(collaborator), { taskId: b! })

    const events = await repos.timeline.listByTask(organizationId, b!)
    expect(events.map((event) => event.type).sort()).toEqual(['moved_to_board', 'status_changed'])
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'status_changed',
          payload: { before: 'todo', after: 'planning' },
          actorUserId: userId,
          asManager: false,
        }),
        expect.objectContaining({ type: 'moved_to_board', actorUserId: userId, asManager: false }),
      ]),
    )
  })

  it('o gestor leva tarefa de colaborador e as edições saem marcadas como Gestor', async () => {
    const { useCases, repos } = setup()
    const [, , c] = await seedBacklogOfThree(repos)

    await useCases.backlog.takeToBoard.execute(...call(manager), { taskId: c! })

    const events = await repos.timeline.listByTask(organizationId, c!)
    expect(events.map((event) => event.type).sort()).toEqual(['moved_to_board', 'status_changed'])
    expect(events.every((event) => event.actorUserId === managerId && event.asManager)).toBe(true)
  })

  it('tarefa já em Planejamento gera só o evento de ida ao quadro, sem duplicar', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1, status: 'planning' }))

    await useCases.backlog.takeToBoard.execute(...call(collaborator), {
      taskId: String(501).padStart(26, '0'),
    })

    const events = await repos.timeline.listByTask(
      organizationId,
      toTaskId(String(501).padStart(26, '0')),
    )
    expect(events.map((event) => event.type)).toEqual(['moved_to_board'])
  })

  it('quem não participa da tarefa não a leva ao quadro', async () => {
    const { useCases, repos, notifier } = setup()
    const [, , c] = await seedBacklogOfThree(repos)
    const before = await backlogOrder(repos)

    // `collaborator` não criou nem participa de `c` (criada por `otherUserId`).
    await expect(
      useCases.backlog.takeToBoard.execute(...call(collaborator), { taskId: c! }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(notifier.changes).toEqual([])
  })

  it('tarefa que já está no quadro recusa', async () => {
    const { useCases, repos } = setup()
    await seedBacklogOfThree(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 510 }))

    await expect(
      useCases.backlog.takeToBoard.execute(...call(manager), {
        taskId: String(510).padStart(26, '0'),
      }),
    ).rejects.toThrow(/não está no backlog/)
  })

  it('tarefa arquivada recusa e fica no backlog', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1, archived: true }))

    await expect(
      useCases.backlog.takeToBoard.execute(...call(manager), {
        taskId: String(501).padStart(26, '0'),
      }),
    ).rejects.toThrow(/arquivada/)
    const saved = await repos.tasks.findById(
      organizationId,
      toTaskId(String(501).padStart(26, '0')),
    )
    expect(saved?.backlogRank).toBe(1)
  })

  it('falha ao gravar a linha do tempo desfaz a saída do backlog, a renumeração e o aviso', async () => {
    const { useCases, unitOfWork, repos, notifier } = setup()
    const [, b, c] = await seedBacklogOfThree(repos)
    const before = await backlogOrder(repos)
    vi.spyOn(unitOfWork.repositories.timeline, 'saveMany').mockRejectedValueOnce(
      new Error('falha na linha do tempo'),
    )

    await expect(
      useCases.backlog.takeToBoard.execute(...call(manager), { taskId: b! }),
    ).rejects.toThrow('falha na linha do tempo')

    await expect(backlogOrder(repos)).resolves.toEqual(before)
    expect(await repos.tasks.findById(organizationId, b!)).toMatchObject({
      backlogRank: 2,
      onBoard: false,
      status: 'todo',
    })
    expect(await repos.tasks.findById(organizationId, c!)).toMatchObject({ backlogRank: 3 })
    expect(notifier.changes).toEqual([])
  })

  it('com o módulo Backlog desativado, recusa citando o módulo e não muda nada', async () => {
    const { useCases, repos } = setup()
    const [, b] = await seedBacklogOfThree(repos)
    await setBacklogState(repos, organizationId, 'disabled')

    await expect(
      useCases.backlog.takeToBoard.execute(...call(manager), { taskId: b! }),
    ).rejects.toThrow(/Backlog/)
    expect(await repos.tasks.findById(organizationId, b!)).toMatchObject({ backlogRank: 2 })
  })

  it('tarefa de outro time dá NOT_FOUND e fica intacta', async () => {
    const { useCases, repos } = setup()
    const [, b] = await seedBacklogOfThree(repos)
    await seedOtherOrganization(repos)

    await expect(
      useCases.backlog.takeToBoard.execute(...call(otherManager), { taskId: b! }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await repos.tasks.findById(organizationId, b!)).toMatchObject({ backlogRank: 2 })
  })
})

describe('backlog: devolver ao backlog (Q-a: o estado não muda)', () => {
  it('quem edita devolve a tarefa do quadro ao fim, mantém o estado e não gera evento de estado', async () => {
    const { useCases, repos, notifier } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, status: 'in_progress' }))
    const onBoard = String(502).padStart(26, '0')

    const sent = await useCases.backlog.sendToBacklog.execute(...call(collaborator), {
      taskId: onBoard,
    })

    expect(sent).toMatchObject({ id: onBoard, status: 'in_progress' })
    expect(await repos.tasks.findById(organizationId, toTaskId(onBoard))).toMatchObject({
      backlogRank: 2,
      onBoard: false,
      status: 'in_progress',
    })
    expect(notifier.changes).toEqual([{ organizationId, change: { kind: 'task', ids: [onBoard] } }])
    await expect(repos.timeline.listByTask(organizationId, toTaskId(onBoard))).resolves.toEqual([
      expect.objectContaining({ type: 'sent_to_backlog', actorUserId: userId, asManager: false }),
    ])
  })

  it('o gestor devolve tarefa de colaborador e o evento sai marcado como Gestor', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, status: 'review' }))
    const onBoard = String(502).padStart(26, '0')

    await useCases.backlog.sendToBacklog.execute(...call(manager), { taskId: onBoard })

    await expect(repos.timeline.listByTask(organizationId, toTaskId(onBoard))).resolves.toEqual([
      expect.objectContaining({ type: 'sent_to_backlog', actorUserId: managerId, asManager: true }),
    ])
  })

  it('devolver ao backlog não duplica o evento com a mudança de estado da tarefa', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, status: 'in_progress' }))
    const onBoard = String(502).padStart(26, '0')

    await useCases.backlog.sendToBacklog.execute(...call(collaborator), { taskId: onBoard })

    const events = await repos.timeline.listByTask(organizationId, toTaskId(onBoard))
    expect(events.map((event) => event.type)).toEqual(['sent_to_backlog'])
  })

  it('devolve ao topo e renumera o resto do backlog', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 2 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 503 }))
    const incoming = String(503).padStart(26, '0')

    await useCases.backlog.sendToBacklog.execute(...call(manager), {
      taskId: incoming,
      placement: 'top',
    })

    expect(await backlogOrder(repos)).toEqual([
      [toTaskId(incoming), 1],
      [toTaskId(String(501).padStart(26, '0')), 2],
      [toTaskId(String(502).padStart(26, '0')), 3],
    ])
  })

  it('devolve no meio do backlog quando recebe um índice', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 2 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 503 }))

    await useCases.backlog.sendToBacklog.execute(...call(collaborator), {
      taskId: String(503).padStart(26, '0'),
      placement: 1,
    })

    const ids = (await repos.tasks.listBacklog(organizationId)).map((task) => task.id)
    expect(ids).toEqual([
      toTaskId(String(501).padStart(26, '0')),
      toTaskId(String(503).padStart(26, '0')),
      toTaskId(String(502).padStart(26, '0')),
    ])
  })

  it('tarefa que já está no backlog recusa', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))

    await expect(
      useCases.backlog.sendToBacklog.execute(...call(manager), {
        taskId: String(501).padStart(26, '0'),
      }),
    ).rejects.toThrow(/já está no backlog/)
  })

  it('quem não participa não devolve a tarefa', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, createdBy: otherUserId }))

    await expect(
      useCases.backlog.sendToBacklog.execute(...call(collaborator), {
        taskId: String(502).padStart(26, '0'),
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    expect(
      await repos.tasks.findById(organizationId, toTaskId(String(502).padStart(26, '0'))),
    ).toMatchObject({ backlogRank: null, onBoard: true })
  })

  it('tarefa arquivada recusa', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, archived: true }))

    await expect(
      useCases.backlog.sendToBacklog.execute(...call(manager), {
        taskId: String(502).padStart(26, '0'),
      }),
    ).rejects.toThrow(/arquivada/)
  })

  it('com o módulo Backlog desativado, recusa citando o módulo', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502 }))
    await setBacklogState(repos, organizationId, 'disabled')

    await expect(
      useCases.backlog.sendToBacklog.execute(...call(manager), {
        taskId: String(502).padStart(26, '0'),
      }),
    ).rejects.toThrow(/Backlog/)
  })
})

describe('backlog: criar tarefa no backlog (Q4)', () => {
  it('com inBacklog, a tarefa nasce no fim do backlog e fora do quadro', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501, rank: 1 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 2 }))

    const created = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Nova no backlog',
      inBacklog: true,
    })

    const saved = await repos.tasks.findById(organizationId, toTaskId(created.id))
    expect(saved).toMatchObject({ backlogRank: 3, onBoard: false, status: 'planning' })
    expect(await backlogOrder(repos)).toEqual([
      [toTaskId(String(501).padStart(26, '0')), 1],
      [toTaskId(String(502).padStart(26, '0')), 2],
      [toTaskId(created.id), 3],
    ])
    await expect(
      repos.timeline.listByTask(organizationId, toTaskId(created.id)),
    ).resolves.toMatchObject([{ type: 'task_created', actorUserId: userId, asManager: false }])
  })

  it('duas criações em sequência no backlog recebem posições diferentes', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)

    const first = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Primeira',
      inBacklog: true,
    })
    const second = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Segunda',
      inBacklog: true,
    })

    expect(await backlogOrder(repos)).toEqual([
      [toTaskId(first.id), 1],
      [toTaskId(second.id), 2],
    ])
  })

  it('sem inBacklog, a tarefa continua no quadro, mesmo com o Backlog ativo', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)

    const created = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Nova no quadro',
    })

    expect(await repos.tasks.findById(organizationId, toTaskId(created.id))).toMatchObject({
      backlogRank: null,
      onBoard: true,
    })
  })

  it('com o módulo Backlog desativado, inBacklog recusa citando o módulo e não grava', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await setBacklogState(repos, organizationId, 'disabled')

    await expect(
      useCases.tasks.create.execute(...call(collaborator), {
        projectId,
        title: 'Não deve existir',
        inBacklog: true,
      }),
    ).rejects.toThrow(/Backlog/)
    await expect(repos.tasks.listBoard(organizationId, {})).resolves.toEqual([])
  })

  it('com o Backlog encerrando, recusa criar item novo no backlog', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)
    await setBacklogState(repos, organizationId, 'winding_down')

    await expect(
      useCases.tasks.create.execute(...call(collaborator), {
        projectId,
        title: 'Não deve existir',
        inBacklog: true,
      }),
    ).rejects.toThrow(/encerrando/)
  })
})

describe('quadro com o módulo Backlog (B1 A)', () => {
  async function seedBoardAndBacklog(repos: UnitOfWorkRepositories) {
    await seedTeam(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 1 }))
    return String(501).padStart(26, '0')
  }

  it('com o Backlog ativo, o quadro e a Equipe não mostram tarefas do backlog', async () => {
    const { useCases, repos } = setup()
    const onBoard = await seedBoardAndBacklog(repos)

    const board = await useCases.tasks.listBoard.execute(...call(collaborator), {})
    const team = await useCases.tasks.listTeamBoard.execute(...call(manager), {})

    expect(board.map((task) => task.id)).toEqual([onBoard])
    expect(team.map((task) => task.id)).toEqual([onBoard])
  })

  it('com o Backlog encerrando, o backlog continua fora do quadro', async () => {
    const { useCases, repos } = setup()
    const onBoard = await seedBoardAndBacklog(repos)
    await setBacklogState(repos, organizationId, 'winding_down')

    const board = await useCases.tasks.listBoard.execute(...call(collaborator), {})

    expect(board.map((task) => task.id)).toEqual([onBoard])
  })

  it('com o Backlog desativado, o quadro mostra tudo, como antes do backlog', async () => {
    const { useCases, repos } = setup()
    await seedBoardAndBacklog(repos)
    await setBacklogState(repos, organizationId, 'disabled')

    const board = await useCases.tasks.listBoard.execute(...call(collaborator), {})
    const team = await useCases.tasks.listTeamBoard.execute(...call(manager), {})

    expect(board).toHaveLength(2)
    expect(team).toHaveLength(2)
  })

  it('com o módulo Backlog nunca gravado, o quadro mostra tudo, como antes do backlog', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos, null)
    await repos.tasks.save(organizationId, aSeedTask({ n: 501 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 1 }))

    const board = await useCases.tasks.listBoard.execute(...call(collaborator), {})
    const team = await useCases.tasks.listTeamBoard.execute(...call(manager), {})

    expect(board).toHaveLength(2)
    expect(team).toHaveLength(2)
  })

  it('time com preset sem Backlog gravado (só núcleo e agenda): nada some do quadro', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos, null)
    for (const moduleId of ['core', 'agenda'] as const) {
      await repos.teamModules.save(organizationId, {
        moduleId,
        state: 'active',
        config: {},
        changedBy: managerId,
        changedAt: timestamp,
      })
    }
    await repos.tasks.save(organizationId, aSeedTask({ n: 501 }))
    await repos.tasks.save(organizationId, aSeedTask({ n: 502, rank: 1 }))

    const board = await useCases.tasks.listBoard.execute(...call(collaborator), {})

    expect(board).toHaveLength(2)
  })
})

describe('backlog: devolver com id de outro time', () => {
  it('dá NOT_FOUND e não grava nem avisa', async () => {
    const { useCases, repos, notifier } = setup()
    await seedTeam(repos)
    await seedOtherOrganization(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 502 }))
    const taskId = String(502).padStart(26, '0')

    await expect(
      useCases.backlog.sendToBacklog.execute(...call(otherManager), { taskId }),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(await repos.tasks.findById(organizationId, toTaskId(taskId))).toMatchObject({
      backlogRank: null,
      onBoard: true,
    })
    expect(notifier.changes).toEqual([])
  })
})

describe('criar no backlog (Q7: inBacklog força Planejamento)', () => {
  it('com inBacklog, ignora o estado pedido e entra em Planejamento', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)

    const created = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Pedida em andamento',
      status: 'in_progress',
      inBacklog: true,
    })

    expect(await repos.tasks.findById(organizationId, toTaskId(created.id))).toMatchObject({
      status: 'planning',
      backlogRank: 1,
      onBoard: false,
    })
  })

  it('sem inBacklog, o estado pedido vale', async () => {
    const { useCases, repos } = setup()
    await seedTeam(repos)

    const created = await useCases.tasks.create.execute(...call(collaborator), {
      projectId,
      title: 'Pedida no quadro',
      status: 'in_progress',
    })

    expect(await repos.tasks.findById(organizationId, toTaskId(created.id))).toMatchObject({
      status: 'in_progress',
      onBoard: true,
    })
  })
})

describe('backlog: arquivar e desarquivar (sem posição repetida)', () => {
  const idOf = (n: number) => toTaskId(String(n).padStart(26, '0'))

  async function seedThreeInBacklog(repos: UnitOfWorkRepositories) {
    await seedTeam(repos)
    for (const n of [501, 502, 503]) {
      await repos.tasks.save(organizationId, aSeedTask({ n, rank: n - 500 }))
    }
  }

  it('arquivar não muda a posição da tarefa', async () => {
    const { useCases, repos } = setup()
    await seedThreeInBacklog(repos)

    await useCases.tasks.archive.execute(...call(collaborator), { taskId: idOf(501) })

    expect(await repos.tasks.findById(organizationId, idOf(501))).toMatchObject({
      archivedAt: now,
      backlogRank: 1,
    })
    expect(await backlogOrder(repos)).toEqual([
      [idOf(502), 2],
      [idOf(503), 3],
    ])
  })

  it('arquivar, mover outra tarefa ao topo e desarquivar não repete posição: a volta vai ao fim', async () => {
    const { useCases, repos } = setup()
    await seedThreeInBacklog(repos)
    await useCases.tasks.archive.execute(...call(collaborator), { taskId: idOf(501) })
    await useCases.backlog.reorder.execute(...call(manager), {
      taskId: idOf(503),
      placement: 'top',
    })

    await useCases.tasks.unarchive.execute(...call(collaborator), { taskId: idOf(501) })

    expect(await backlogOrder(repos)).toEqual([
      [idOf(503), 1],
      [idOf(502), 2],
      [idOf(501), 3],
    ])
    expect(await repos.tasks.findById(organizationId, idOf(501))).toMatchObject({
      archivedAt: null,
      onBoard: false,
    })
  })

  it('desarquivar tarefa que estava no quadro não mexe no backlog', async () => {
    const { useCases, repos } = setup()
    await seedThreeInBacklog(repos)
    await repos.tasks.save(organizationId, aSeedTask({ n: 510, archived: true }))
    const before = await backlogOrder(repos)

    await useCases.tasks.unarchive.execute(...call(collaborator), { taskId: idOf(510) })

    expect(await repos.tasks.findById(organizationId, idOf(510))).toMatchObject({
      archivedAt: null,
      backlogRank: null,
      onBoard: true,
    })
    await expect(backlogOrder(repos)).resolves.toEqual(before)
  })
})
