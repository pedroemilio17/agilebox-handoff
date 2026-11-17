import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  createProject,
  createUser,
  toOrganizationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, TimelineEvent } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession, UnitOfWork, UnitOfWorkRepositories } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const NOW = '2026-11-16T12:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const projectId = toProjectId('00000000000000000000000005')
const anaId = toUserId('00000000000000000000000011')
const brunoId = toUserId('00000000000000000000000012')
const managerId = toUserId('00000000000000000000000013')
const managerBId = toUserId('00000000000000000000000021')
const ana: Actor = { userId: anaId, organizationId: orgA, role: 'collaborator' }
const bruno: Actor = { userId: brunoId, organizationId: orgA, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }
const ctx = (actor: Actor): TenantContext => createTenantContext(actor)

interface Setup {
  readonly useCases: ReturnType<typeof createUseCases>
  readonly unitOfWork: InMemoryUnitOfWork
  readonly repos: UnitOfWorkRepositories
  readonly notifier: RecordingNotifier
  /** Troca a unidade de trabalho usada pelos casos de uso (para simular falha no meio da gravação). */
  readonly useCasesWith: (uow: UnitOfWork) => ReturnType<typeof createUseCases>
}

async function setup(): Promise<Setup> {
  const unitOfWork = new InMemoryUnitOfWork()
  const repos = unitOfWork.repositories
  for (const [id, name] of [
    [orgA, 'Time A'],
    [orgB, 'Time B'],
  ] as const)
    await repos.organizations.save(
      createOrganization({ id, name, taskPrefix: 'SPR', createdAt: '2026-01-01T00:00:00.000Z' }),
    )
  const people = [
    [orgA, anaId, 'Ana', 'collaborator'],
    [orgA, brunoId, 'Bruno', 'collaborator'],
    [orgA, managerId, 'Gestora', 'manager'],
    [orgB, managerBId, 'Gestor B', 'manager'],
  ] as const
  for (const [organizationId, id, name, role] of people)
    await repos.users.save(
      organizationId,
      createUser({
        ...aUser().build(),
        id,
        organizationId,
        name,
        role,
        email: `${name.toLowerCase().replace(' ', '')}@example.com`,
      }),
    )
  await repos.projects.save(
    orgA,
    createProject({
      id: projectId,
      organizationId: orgA,
      name: 'Projeto A',
      createdBy: anaId,
      createdAt: NOW,
    }),
  )
  for (const userId of [anaId, managerId])
    await repos.projects.addMember(orgA, { projectId, userId, addedBy: anaId, addedAt: NOW })

  let current = ana
  const actorSession: ActorSession = { get: () => current, set: (actor) => (current = actor) }
  const notifier = new RecordingNotifier()
  const build = (uow: UnitOfWork) =>
    createUseCases({
      actorSession,
      changeNotifier: notifier,
      clock: new FixedClock(NOW),
      acceptance: repos.acceptance,
      boardSettings: repos.boardSettings,
      checklist: repos.checklist,
      comments: repos.comments,
      contributors: repos.contributors,
      dailyEntries: repos.dailyEntries,
      definitionOfDone: repos.definitionOfDone,
      idGenerator: new SequentialIdGenerator(),
      meetings: repos.meetings,
      organizations: repos.organizations,
      participations: repos.participations,
      projects: repos.projects,
      retroActions: repos.retroActions,
      sprints: repos.sprints,
      sprintTasks: repos.sprintTasks,
      impediments: repos.impediments,
      taskOpens: repos.taskOpens,
      tasks: repos.tasks,
      teamTools: repos.teamTools,
      projectModules: repos.projectModules,
      timeline: repos.timeline,
      unitOfWork: uow,
      users: repos.users,
    })
  return {
    useCases: build(unitOfWork),
    unitOfWork,
    repos,
    notifier,
    useCasesWith: build,
  }
}

type Ctx = Awaited<ReturnType<typeof setup>>
const ids = (tasks: readonly { id: string }[]) => tasks.map((task) => task.id)

async function createSprint(c: Ctx, name = '', actor: Actor = ana) {
  return c.useCases.sprints.create.execute(ctx(actor), {
    projectId,
    name,
    plannedStart: '2026-11-16',
    plannedEnd: '2026-11-27',
  })
}

async function boardTask(
  c: Ctx,
  title: string,
  status?: 'todo' | 'in_progress' | 'review' | 'done',
) {
  const task = await c.useCases.tasks.create.execute(ctx(ana), {
    projectId,
    title,
    ...(status === undefined ? {} : { status: status === 'done' ? 'todo' : status }),
  })
  if (status === 'done')
    return c.useCases.tasks.move.execute(ctx(ana), { taskId: task.id, status: 'done' })
  return task
}

async function backlogItem(c: Ctx, title: string) {
  return c.useCases.backlog.add.execute(ctx(ana), { projectId, title })
}

async function change(
  c: Ctx,
  input: { enable?: string[]; disable?: string[]; finalize?: string[] },
) {
  return c.useCases.teamTools.applyChange.execute(ctx(manager), input)
}

async function eventsOf(c: Ctx, taskId: string): Promise<readonly TimelineEvent[]> {
  return c.repos.timeline.listByTask(orgA, toTaskId(taskId))
}

async function rejectionOf(promise: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await promise
  } catch (error) {
    return error as { code: string; message: string }
  }
  throw new Error('esperava recusa')
}

describe('sprints: ciclo completo, do backlog ao replanejamento', () => {
  it('backlog → planejamento (criar e adicionar) → início (puxa o backlog) → encerramento → replanejamento, com histórico', async () => {
    const c = await setup()
    const item = await backlogItem(c, 'Relatório do mês')

    const planned = await createSprint(c, '')
    expect(planned.sprint).toMatchObject({
      number: 1,
      label: 'Sprint 1',
      name: 'Sprint 1',
      status: 'draft',
    })

    // Adicionar item de backlog a rascunho não o move: segue no backlog, e a sprint mostra o item.
    const added = await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: planned.sprint.id,
      taskId: item.id,
    })
    expect(added.items).toEqual([
      expect.objectContaining({
        id: item.id,
        inBacklog: true,
        sprint: { id: planned.sprint.id, number: 1, name: 'Sprint 1', status: 'draft' },
      }),
    ])
    expect(ids(await c.useCases.backlog.list.execute(ctx(ana), { projectId }))).toEqual([item.id])

    // Iniciar: o item sai do backlog e vai para o quadro, em A fazer, com o evento de backlog.
    const started = await c.useCases.sprints.start.execute(ctx(ana), {
      sprintId: planned.sprint.id,
    })
    expect(started.sprint).toMatchObject({ status: 'active' })
    expect(started.items[0]).toMatchObject({ status: 'todo', inBacklog: false })
    expect(await c.useCases.backlog.list.execute(ctx(ana), { projectId })).toEqual([])
    const types = (await eventsOf(c, item.id)).map((event) => event.type)
    expect(types).toEqual(
      expect.arrayContaining(['task_added_to_sprint', 'task_pulled_from_backlog']),
    )

    // Limite 1 (padrão): a segunda sprint não inicia enquanto a primeira está ativa.
    const second = await createSprint(c, '')
    expect(second.sprint.number).toBe(2)
    expect(
      await rejectionOf(c.useCases.sprints.start.execute(ctx(ana), { sprintId: second.sprint.id })),
    ).toMatchObject({
      code: 'CONFLICT',
    })

    // Encerrar com devolução: o item já foi puxado para A fazer, então volta ao backlog em Planejamento.
    const closed = await c.useCases.sprints.close.execute(ctx(ana), {
      sprintId: planned.sprint.id,
      policy: 'return_to_backlog',
    })
    expect(closed.sprint).toMatchObject({ status: 'closed', closePolicy: 'return_to_backlog' })
    expect(closed.items).toEqual([])
    expect(closed.history).toEqual([
      expect.objectContaining({ taskId: item.id, outcome: 'returned_to_backlog' }),
    ])
    const back = (await c.useCases.backlog.list.execute(ctx(ana), { projectId }))[0]
    expect(back).toMatchObject({ id: item.id, status: 'planning', inBacklog: true })

    // Replanejamento: nova sprint com o mesmo item; o histórico da primeira continua.
    const replanned = await createSprint(c, 'Replanejada')
    expect(replanned.sprint.number).toBe(3)
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: replanned.sprint.id,
      taskId: item.id,
    })
    const relisted = await c.useCases.sprints.get.execute(ctx(ana), {
      sprintId: replanned.sprint.id,
    })
    expect(relisted.items.map((task) => task.id)).toEqual([item.id])
    const old = await c.useCases.sprints.get.execute(ctx(ana), { sprintId: planned.sprint.id })
    expect(old.history.map((row) => row.outcome)).toEqual(['returned_to_backlog'])
  })

  it('o limite de sprints ativas vem da configuração do módulo (ADR-08): 2 deixa iniciar a segunda, 3 é o máximo', async () => {
    const c = await setup()
    const first = await createSprint(c, '')
    const second = await createSprint(c, '')
    await c.useCases.sprints.start.execute(ctx(ana), { sprintId: first.sprint.id })
    expect(
      await rejectionOf(c.useCases.sprints.start.execute(ctx(ana), { sprintId: second.sprint.id })),
    ).toMatchObject({ code: 'CONFLICT' })

    await c.useCases.teamTools.setModuleConfig.execute(ctx(manager), {
      moduleId: 'sprints',
      config: { maxActiveSprints: 2 },
    })
    const started = await c.useCases.sprints.start.execute(ctx(ana), { sprintId: second.sprint.id })
    expect(started.sprint.status).toBe('active')

    const view = await c.useCases.teamTools.get.execute(ctx(ana))
    expect(view.modules.find((module) => module.id === 'sprints')?.config).toEqual({
      maxActiveSprints: 2,
    })
  })
})

describe('sprints: encerramento com as duas políticas e os desfechos', () => {
  async function fixture(c: Ctx) {
    const planning = await c.useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'Planejamento',
    })
    const inProgress = await boardTask(c, 'Em andamento', 'in_progress')
    const review = await boardTask(c, 'Em revisão', 'review')
    const done = await boardTask(c, 'Concluída', 'done')
    const archived = await boardTask(c, 'Arquivada')
    const sprint = await createSprint(c, 'Sprint de teste')
    for (const task of [planning, inProgress, review, done, archived])
      await c.useCases.sprints.addTask.execute(ctx(ana), {
        sprintId: sprint.sprint.id,
        taskId: task.id,
      })
    // Arquiva depois de entrar: arquivada não entra em sprint, mas a que já está nela sai como removida.
    await c.useCases.tasks.archive.execute(ctx(ana), { taskId: archived.id })
    await c.useCases.sprints.start.execute(ctx(ana), { sprintId: sprint.sprint.id })
    return { planning, inProgress, review, done, archived, sprintId: sprint.sprint.id }
  }

  it('return_to_backlog: não iniciado volta ao backlog; iniciado fica no quadro; concluído fica; arquivado sai', async () => {
    const c = await setup()
    const f = await fixture(c)
    const closed = await c.useCases.sprints.close.execute(ctx(ana), {
      sprintId: f.sprintId,
      policy: 'return_to_backlog',
    })
    const outcome = (id: string) => closed.history.find((row) => row.taskId === id)?.outcome
    expect(outcome(f.planning.id)).toBe('returned_to_backlog')
    expect(outcome(f.inProgress.id)).toBe('left_on_board')
    expect(outcome(f.review.id)).toBe('left_on_board')
    expect(outcome(f.done.id)).toBe('completed')
    expect(outcome(f.archived.id)).toBe('removed')

    const backlog = await c.useCases.backlog.list.execute(ctx(ana), { projectId })
    expect(ids(backlog)).toEqual([f.planning.id])
    const board = await c.useCases.tasks.listBoard.execute(ctx(ana), {})
    const onBoard = board.tasks.find((task) => task.id === f.inProgress.id)
    expect(onBoard).toMatchObject({ status: 'in_progress', inBacklog: false, sprint: null })
    expect(board.tasks.find((task) => task.id === f.review.id)).toMatchObject({
      status: 'review',
      sprint: null,
    })
  })

  it('carry_over: abertos seguem para a sprint seguinte (nova linha), concluído continua, arquivado sai', async () => {
    const c = await setup()
    const f = await fixture(c)
    const next = await createSprint(c, 'Próxima')
    const closed = await c.useCases.sprints.close.execute(ctx(ana), {
      sprintId: f.sprintId,
      policy: 'carry_over',
      nextSprintId: next.sprint.id,
    })
    const outcome = (id: string) => closed.history.find((row) => row.taskId === id)?.outcome
    expect(outcome(f.planning.id)).toBe('carried_over')
    expect(outcome(f.inProgress.id)).toBe('carried_over')
    expect(outcome(f.done.id)).toBe('completed')
    expect(outcome(f.archived.id)).toBe('removed')

    const nextDetail = await c.useCases.sprints.get.execute(ctx(ana), { sprintId: next.sprint.id })
    expect(ids(nextDetail.items).sort()).toEqual(
      [f.planning.id, f.inProgress.id, f.review.id].sort(),
    )
    expect(await c.useCases.backlog.list.execute(ctx(ana), { projectId })).toEqual([])
  })

  it('carry_over recusa sprint seguinte que não é rascunho, a própria sprint e pedido sem a sprint seguinte', async () => {
    const c = await setup()
    const f = await fixture(c)
    // Sprint seguinte descartada não existe mais para o encerramento.
    const old = await createSprint(c, 'Descartada')
    await c.useCases.sprints.discard.execute(ctx(ana), { sprintId: old.sprint.id })
    expect(
      await rejectionOf(
        c.useCases.sprints.close.execute(ctx(ana), {
          sprintId: f.sprintId,
          policy: 'carry_over',
          nextSprintId: f.sprintId,
        }),
      ),
    ).toMatchObject({ code: 'VALIDATION' })
    expect(
      await rejectionOf(
        c.useCases.sprints.close.execute(ctx(ana), { sprintId: f.sprintId, policy: 'carry_over' }),
      ),
    ).toMatchObject({ code: 'VALIDATION' })
    // Descartada não serve de seguinte: não é encontrada.
    expect(
      await rejectionOf(
        c.useCases.sprints.close.execute(ctx(ana), {
          sprintId: f.sprintId,
          policy: 'carry_over',
          nextSprintId: old.sprint.id,
        }),
      ),
    ).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('o encerramento é atômico: se a linha do tempo falha no meio, nada da sprint nem das tarefas fica gravado', async () => {
    const c = await setup()
    const f = await fixture(c)
    const broken = c.useCasesWith({
      run: (organizationId, operation) =>
        c.unitOfWork.run(organizationId, (repos) =>
          operation({
            ...repos,
            timeline: {
              ...repos.timeline,
              saveMany: async () => {
                await Promise.resolve()
                throw new Error('falha simulada')
              },
            },
          }),
        ),
    })
    await expect(
      broken.sprints.close.execute(ctx(ana), { sprintId: f.sprintId, policy: 'return_to_backlog' }),
    ).rejects.toThrow('falha simulada')
    const detail = await c.useCases.sprints.get.execute(ctx(ana), { sprintId: f.sprintId })
    expect(detail.sprint.status).toBe('active')
    expect(detail.items).toHaveLength(5)
    expect(detail.history.every((row) => row.outcome === 'open')).toBe(true)
    expect(await c.useCases.backlog.list.execute(ctx(ana), { projectId })).toEqual([])
  })
})

describe('sprints: descarte lógico, numeração e uma tarefa em uma sprint só', () => {
  it('descarte de rascunho: sai das listas, o número não se reaproveita, e itens voltam ao backlog com confirmação', async () => {
    const c = await setup()
    const draft = await createSprint(c, 'Descartável')
    const task = await boardTask(c, 'Tarefa')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: draft.sprint.id,
      taskId: task.id,
    })

    expect(
      await rejectionOf(
        c.useCases.sprints.discard.execute(ctx(ana), { sprintId: draft.sprint.id }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    await c.useCases.sprints.discard.execute(ctx(ana), {
      sprintId: draft.sprint.id,
      returnToBacklog: true,
    })

    expect(await c.useCases.sprints.list.execute(ctx(ana), { projectId })).toEqual([])
    expect(
      await rejectionOf(c.useCases.sprints.get.execute(ctx(ana), { sprintId: draft.sprint.id })),
    ).toMatchObject({ code: 'NOT_FOUND' })
    // A tarefa estava em A fazer: volta ao backlog em Planejamento.
    expect(ids(await c.useCases.backlog.list.execute(ctx(ana), { projectId }))).toEqual([task.id])

    const next = await createSprint(c, '')
    expect(next.sprint.number).toBe(2)
  })

  it('descarte só vale para rascunho: sprint ativa não é descartada', async () => {
    const c = await setup()
    const active = await createSprint(c, '')
    await c.useCases.sprints.start.execute(ctx(ana), { sprintId: active.sprint.id })
    expect(
      await rejectionOf(
        c.useCases.sprints.discard.execute(ctx(ana), {
          sprintId: active.sprint.id,
          returnToBacklog: true,
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
  })

  it('uma tarefa só tem uma sprint aberta; ao sair, a linha fecha e ela pode entrar em outra', async () => {
    const c = await setup()
    const first = await createSprint(c, '')
    const second = await createSprint(c, '')
    const task = await boardTask(c, 'Tarefa única')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: first.sprint.id,
      taskId: task.id,
    })
    expect(
      await rejectionOf(
        c.useCases.sprints.addTask.execute(ctx(ana), {
          sprintId: second.sprint.id,
          taskId: task.id,
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })

    await c.useCases.sprints.removeTask.execute(ctx(ana), {
      sprintId: first.sprint.id,
      taskId: task.id,
    })
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: second.sprint.id,
      taskId: task.id,
    })
    const firstDetail = await c.useCases.sprints.get.execute(ctx(ana), {
      sprintId: first.sprint.id,
    })
    expect(firstDetail.items).toEqual([])
    expect(firstDetail.history).toEqual([
      expect.objectContaining({ taskId: task.id, outcome: 'removed' }),
    ])
  })

  it('remover item da sprint não o devolve ao backlog, e a linha fica no histórico', async () => {
    const c = await setup()
    const sprint = await createSprint(c, '')
    const item = await backlogItem(c, 'Fica no backlog')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: item.id,
    })
    await c.useCases.sprints.removeTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: item.id,
    })
    expect(ids(await c.useCases.backlog.list.execute(ctx(ana), { projectId }))).toEqual([item.id])
    const detail = await c.useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })
    expect(detail.history[0]).toMatchObject({ outcome: 'removed' })
  })

  it('item de backlog adicionado a sprint ATIVA é puxado para o quadro na hora', async () => {
    const c = await setup()
    const sprint = await createSprint(c, '')
    await c.useCases.sprints.start.execute(ctx(ana), { sprintId: sprint.sprint.id })
    const item = await backlogItem(c, 'Entra agora')
    const detail = await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: item.id,
    })
    expect(detail.items[0]).toMatchObject({ status: 'todo', inBacklog: false })
    expect(await c.useCases.backlog.list.execute(ctx(ana), { projectId })).toEqual([])
  })
})

describe('sprints: regra de acesso e isolamento', () => {
  it('membro e gestor do projeto planejam; quem não é membro não vê nem cria; outra organização não alcança', async () => {
    const c = await setup()
    const sprint = await createSprint(c, '')
    expect(
      ids(
        await c.useCases.sprints.list
          .execute(ctx(manager), { projectId })
          .then((rows) => rows.map((row) => ({ id: row.id }))),
      ),
    ).toEqual([sprint.sprint.id])
    expect(
      await rejectionOf(c.useCases.sprints.list.execute(ctx(bruno), { projectId })),
    ).toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await rejectionOf(
        c.useCases.sprints.create.execute(ctx(bruno), {
          projectId,
          plannedStart: '2026-11-16',
          plannedEnd: '2026-11-27',
        }),
      ),
    ).toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await rejectionOf(
        c.useCases.sprints.get.execute(ctx(managerB), { sprintId: sprint.sprint.id }),
      ),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(
      await rejectionOf(
        c.useCases.sprints.start.execute(ctx(managerB), { sprintId: sprint.sprint.id }),
      ),
    ).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('projeto arquivado não aceita sprint nova', async () => {
    const c = await setup()
    await c.useCases.projects.archive.execute(ctx(ana), { projectId })
    expect(
      await rejectionOf(
        c.useCases.sprints.create.execute(ctx(ana), {
          projectId,
          plannedStart: '2026-11-16',
          plannedEnd: '2026-11-27',
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
  })

  it('o número sequencial é por projeto e as datas são validadas pelo domínio', async () => {
    const c = await setup()
    expect(
      await rejectionOf(
        c.useCases.sprints.create.execute(ctx(ana), {
          projectId,
          plannedStart: '2026-11-27',
          plannedEnd: '2026-11-16',
        }),
      ),
    ).toMatchObject({ code: 'VALIDATION' })
    const first = await createSprint(c, '')
    expect(first.sprint.number).toBe(1)
  })
})

describe('sprints: guard de módulo (encerrando e desativado)', () => {
  it('encerrando: recusa criar, adicionar e iniciar; permite encerrar a ativa, remover item, editar e consultar', async () => {
    const c = await setup()
    const active = await createSprint(c, 'Ativa')
    const task = await boardTask(c, 'Tarefa no meio')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: active.sprint.id,
      taskId: task.id,
    })
    await c.useCases.sprints.start.execute(ctx(ana), { sprintId: active.sprint.id })
    const draft = await createSprint(c, 'Rascunho')
    await change(c, { disable: ['burndown', 'reviewRetro', 'sprints'] })

    expect(
      await rejectionOf(
        c.useCases.sprints.create.execute(ctx(ana), {
          projectId,
          plannedStart: '2026-11-16',
          plannedEnd: '2026-11-27',
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    expect(
      await rejectionOf(
        c.useCases.sprints.addTask.execute(ctx(ana), {
          sprintId: draft.sprint.id,
          taskId: task.id,
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    expect(
      await rejectionOf(c.useCases.sprints.start.execute(ctx(ana), { sprintId: draft.sprint.id })),
    ).toMatchObject({ code: 'CONFLICT' })

    await c.useCases.sprints.removeTask.execute(ctx(ana), {
      sprintId: active.sprint.id,
      taskId: task.id,
    })
    await c.useCases.sprints.update.execute(ctx(ana), {
      sprintId: active.sprint.id,
      name: 'Editada',
    })
    expect(
      (await c.useCases.sprints.get.execute(ctx(ana), { sprintId: active.sprint.id })).sprint.name,
    ).toBe('Editada')
    // Encerrar a ativa segue permitido. Com carry_over é recusado, porque levar os itens cria linhas novas.
    expect(
      await rejectionOf(
        c.useCases.sprints.close.execute(ctx(ana), {
          sprintId: active.sprint.id,
          policy: 'carry_over',
          nextSprintId: draft.sprint.id,
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    const closed = await c.useCases.sprints.close.execute(ctx(ana), {
      sprintId: active.sprint.id,
      policy: 'return_to_backlog',
    })
    expect(closed.sprint.status).toBe('closed')
  })

  it('desativado recusa tudo, leitura inclusive; reativar devolve os dados como estavam', async () => {
    const c = await setup()
    const sprint = await createSprint(c, 'Guardada')
    const task = await boardTask(c, 'Tarefa guardada')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: task.id,
    })
    await change(c, {
      disable: ['burndown', 'reviewRetro', 'sprints'],
      finalize: ['burndown', 'reviewRetro', 'sprints'],
    })

    expect(
      await rejectionOf(c.useCases.sprints.list.execute(ctx(ana), { projectId })),
    ).toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await rejectionOf(c.useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })),
    ).toMatchObject({ code: 'FORBIDDEN' })

    await change(c, { enable: ['sprints'] })
    const back = await c.useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })
    expect(back.sprint.name).toBe('Guardada')
    expect(ids(back.items)).toEqual([task.id])
    expect(back.items[0]?.sprint).toMatchObject({ number: 1, status: 'draft' })
  })
})

describe('sprints: configuração do limite e prévia de impacto', () => {
  it('setModuleConfig: só o gestor, só módulo configurável, inteiro de 1 a 5', async () => {
    const c = await setup()
    await expect(
      c.useCases.teamTools.setModuleConfig.execute(ctx(ana), {
        moduleId: 'sprints',
        config: { maxActiveSprints: 2 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    for (const config of [
      { maxActiveSprints: 0 },
      { maxActiveSprints: 6 },
      { maxActiveSprints: 1.5 },
      { outra: 1 },
    ]) {
      await expect(
        c.useCases.teamTools.setModuleConfig.execute(ctx(manager), { moduleId: 'sprints', config }),
      ).rejects.toMatchObject({ code: 'VALIDATION' })
    }
    await expect(
      c.useCases.teamTools.setModuleConfig.execute(ctx(manager), {
        moduleId: 'backlog',
        config: { maxActiveSprints: 2 },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const view = await c.useCases.teamTools.setModuleConfig.execute(ctx(manager), {
      moduleId: 'sprints',
      config: { maxActiveSprints: 5 },
    })
    expect(view.modules.find((module) => module.id === 'sprints')?.config).toEqual({
      maxActiveSprints: 5,
    })
  })

  it('prévia de impacto de desligar Sprints conta sprints não encerradas e itens em sprint', async () => {
    const c = await setup()
    const open = await createSprint(c, '')
    const task = await boardTask(c, 'Item')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: open.sprint.id,
      taskId: task.id,
    })
    const closedSprint = await createSprint(c, '')
    await c.useCases.sprints.discard.execute(ctx(ana), { sprintId: closedSprint.sprint.id })

    const preview = await c.useCases.teamTools.previewChange.execute(ctx(manager), {
      disable: ['sprints'],
    })
    expect(preview.impact).toEqual([
      expect.objectContaining({
        module: 'sprints',
        count: 2,
        description: '1 sprint não encerrada e 1 item em sprint',
      }),
    ])
  })
})

describe('sprints: DTO de tarefa e linha do tempo', () => {
  it('com o módulo desativado, o campo de sprint vem nulo (o efeito passivo some junto com o módulo)', async () => {
    const c = await setup()
    const sprint = await createSprint(c, '')
    const task = await boardTask(c, 'Tarefa que estava na sprint')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: task.id,
    })
    await change(c, {
      disable: ['burndown', 'reviewRetro', 'sprints'],
      finalize: ['burndown', 'reviewRetro', 'sprints'],
    })
    const board = await c.useCases.tasks.listBoard.execute(ctx(ana), {})
    expect(board.tasks.find((row) => row.id === task.id)?.sprint).toBeNull()
  })

  it('a tarefa mostra a sprint aberta atual; sem sprint, nulo; a linha do tempo descreve a entrada', async () => {
    const c = await setup()
    const sprint = await createSprint(c, '')
    const task = await boardTask(c, 'Com sprint')
    const plain = await boardTask(c, 'Sem sprint')
    await c.useCases.sprints.addTask.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      taskId: task.id,
    })
    const board = await c.useCases.tasks.listBoard.execute(ctx(ana), {})
    expect(board.tasks.find((row) => row.id === task.id)?.sprint).toEqual({
      id: sprint.sprint.id,
      number: 1,
      name: 'Sprint 1',
      status: 'draft',
    })
    expect(board.tasks.find((row) => row.id === plain.id)?.sprint).toBeNull()
    const detail = await c.useCases.tasks.getDetail.execute(ctx(ana), { taskId: task.id })
    expect(detail.sprint?.number).toBe(1)
    const timeline = await c.useCases.timeline.list.execute(ctx(ana), { taskId: task.id })
    expect(timeline.map((event) => event.text)).toEqual(
      expect.arrayContaining(['adicionou a tarefa à Sprint 1']),
    )
  })
})
