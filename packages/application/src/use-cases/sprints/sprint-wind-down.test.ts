import { describe, expect, it } from 'vitest'
import {
  createOrganization,
  DEFAULT_TEAM_MODULE_IDS,
  createProject,
  createUser,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Actor, ModuleId, ModuleState } from '@agilebox/core'
import { createTenantContext } from '../../tenant-context'
import type { TenantContext } from '../../tenant-context'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { enableProjectModules, setProjectModules } from '../../testing/task-harness'

/**
 * Caminho completo do encerramento de Sprints (PLANO-2.0, casos de teste de ferramentas): a sprint
 * ativa com itens concluídos, abertos e iniciados entra em encerramento, fecha pela política
 * `return_to_backlog`, vira `disabled` e volta como estava ao reativar.
 */

const NOW = '2026-11-16T12:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('00000000000000000000000002')
const projectId = toProjectId('00000000000000000000000005')
const anaId = toUserId('00000000000000000000000011')
const managerId = toUserId('00000000000000000000000013')
const managerBId = toUserId('00000000000000000000000021')
const ana: Actor = { userId: anaId, organizationId: orgA, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId: orgA, role: 'manager' }
const managerB: Actor = { userId: managerBId, organizationId: orgB, role: 'manager' }
const ctx = (actor: Actor): TenantContext => createTenantContext(actor)

/** Sprints e as ferramentas que dependem delas (Burndown e Revisão/Retro), como no preset Scrum completo. */
const SPRINT_CHAIN: ModuleId[] = ['burndown', 'reviewRetro', 'sprints']

async function setup() {
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
  // Ferramentas do projeto (ADR-10): o projeto de teste começa com as que a equipe trazia por padrão.
  await enableProjectModules(unitOfWork, orgA, projectId, managerId, DEFAULT_TEAM_MODULE_IDS)

  const actorSession: ActorSession = { get: () => ana, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
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
    unitOfWork,
    users: repos.users,
  })
  return { useCases, repos, unitOfWork }
}

type Ctx = Awaited<ReturnType<typeof setup>>

async function rejectionOf(promise: Promise<unknown>): Promise<{ code: string }> {
  try {
    await promise
  } catch (error) {
    return error as { code: string }
  }
  throw new Error('esperava recusa')
}

/** Estado do módulo no projeto de teste (ADR-10: é o que o guard lê). */
async function stateOf(c: Ctx, moduleId: ModuleId, actor: Actor = manager) {
  const view = await c.useCases.projectModules.get.execute(ctx(actor), { projectId })
  return view.modules.find((module) => module.id === moduleId)?.state
}

/** Estado do módulo na equipe, para a organização de quem pede. */
async function teamStateOf(c: Ctx, moduleId: ModuleId, actor: Actor) {
  const view = await c.useCases.teamTools.get.execute(ctx(actor))
  return view.modules.find((module) => module.id === moduleId)?.state
}

/** Muda o estado dos módulos no projeto de teste, sem passar pela equipe (ADR-10). */
async function setProject(c: Ctx, states: Partial<Record<ModuleId, ModuleState>>) {
  await setProjectModules(c.unitOfWork, orgA, projectId, managerId, states)
}

describe('encerramento de Sprints: caminho completo com os três tipos de item', () => {
  it('encerra sem órfãos, leva a disabled, recusa tudo e reativa com sprint, itens e histórico como estavam', async () => {
    const c = await setup()
    const { useCases } = c

    // Sprint ativa: um item de backlog (aberto, vira A fazer ao iniciar), um em andamento e um concluído.
    const aberto = await useCases.backlog.add.execute(ctx(ana), { projectId, title: 'Aberto' })
    const iniciado = await useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'Iniciado',
      status: 'in_progress',
    })
    const concluido0 = await useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'Concluído',
    })
    const concluido = await useCases.tasks.move.execute(ctx(ana), {
      taskId: concluido0.id,
      status: 'done',
    })
    const sprint = await useCases.sprints.create.execute(ctx(ana), {
      projectId,
      name: 'Sprint do encerramento',
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
    })
    for (const task of [aberto, iniciado, concluido])
      await useCases.sprints.addTask.execute(ctx(ana), {
        sprintId: sprint.sprint.id,
        taskId: task.id,
      })
    const active = await useCases.sprints.start.execute(ctx(ana), { sprintId: sprint.sprint.id })
    expect(active.sprint.status).toBe('active')
    const sprintItemIds = active.items.map((item) => item.id).sort()
    expect(sprintItemIds).toEqual([aberto.id, iniciado.id, concluido.id].sort())

    // Um rascunho que existe antes do encerramento, para provar que ele não pode ser iniciado depois.
    const draft = await useCases.sprints.create.execute(ctx(ana), {
      projectId,
      name: 'Rascunho',
      plannedStart: '2026-11-30',
      plannedEnd: '2026-12-11',
    })

    // 1. Desligar Sprints com as dependências: entra em encerramento (não some).
    await setProject(c, Object.fromEntries(SPRINT_CHAIN.map((id) => [id, 'winding_down'])))
    for (const moduleId of SPRINT_CHAIN) expect(await stateOf(c, moduleId)).toBe('winding_down')

    // 2. Criar, iniciar e adicionar item são recusados com CONFLITO.
    expect(
      await rejectionOf(
        useCases.sprints.create.execute(ctx(ana), {
          projectId,
          plannedStart: '2026-12-14',
          plannedEnd: '2026-12-25',
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    expect(
      await rejectionOf(useCases.sprints.start.execute(ctx(ana), { sprintId: draft.sprint.id })),
    ).toMatchObject({ code: 'CONFLICT' })
    const novo = await useCases.backlog.add.execute(ctx(ana), { projectId, title: 'Novo' })
    expect(
      await rejectionOf(
        useCases.sprints.addTask.execute(ctx(ana), { sprintId: draft.sprint.id, taskId: novo.id }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })

    // 3. A sprint ativa segue acompanhável.
    const during = await useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })
    expect(during.sprint.status).toBe('active')
    expect(during.items.map((item) => item.id).sort()).toEqual(sprintItemIds)

    // 4. carry_over é recusado no encerramento; return_to_backlog fecha a sprint.
    expect(
      await rejectionOf(
        useCases.sprints.close.execute(ctx(ana), {
          sprintId: sprint.sprint.id,
          policy: 'carry_over',
          nextSprintId: draft.sprint.id,
        }),
      ),
    ).toMatchObject({ code: 'CONFLICT' })
    const closed = await useCases.sprints.close.execute(ctx(ana), {
      sprintId: sprint.sprint.id,
      policy: 'return_to_backlog',
    })
    expect(closed.sprint).toMatchObject({ status: 'closed', closePolicy: 'return_to_backlog' })

    // 5. Nenhum item órfão: cada item da sprint tem um desfecho no histórico.
    const outcomes = new Map(closed.history.map((row) => [row.taskId, row.outcome]))
    expect(closed.history).toHaveLength(sprintItemIds.length)
    expect([...outcomes.keys()].sort()).toEqual(sprintItemIds)
    expect(outcomes.get(aberto.id)).toBe('returned_to_backlog')
    expect(outcomes.get(iniciado.id)).toBe('left_on_board')
    expect(outcomes.get(concluido.id)).toBe('completed')
    // Cada desfecho tem lugar certo: backlog, quadro ou concluído.
    expect(ids(await useCases.backlog.list.execute(ctx(ana), { projectId })).sort()).toEqual(
      [aberto.id, novo.id].sort(),
    )
    const board = (await useCases.tasks.listBoard.execute(ctx(ana), {})).tasks
    expect(board.find((task) => task.id === iniciado.id)).toMatchObject({
      status: 'in_progress',
      inBacklog: false,
      sprint: null,
    })
    expect(board.find((task) => task.id === concluido.id)).toMatchObject({ status: 'done' })

    // 6. Concluir o encerramento: dependentes primeiro, depois Sprints. Vira disabled.
    await setProject(c, { reviewRetro: 'disabled' })
    await setProject(c, { burndown: 'disabled' })
    await setProject(c, { sprints: 'disabled' })
    for (const moduleId of SPRINT_CHAIN) expect(await stateOf(c, moduleId)).toBe('disabled')

    // 7. Chamadas passam a ser recusadas com FORBIDDEN, leitura inclusive.
    expect(await rejectionOf(useCases.sprints.list.execute(ctx(ana), { projectId }))).toMatchObject(
      { code: 'FORBIDDEN' },
    )
    expect(
      await rejectionOf(useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })),
    ).toMatchObject({ code: 'FORBIDDEN' })
    const boardWhileDisabled = (await useCases.tasks.listBoard.execute(ctx(ana), {})).tasks
    expect(boardWhileDisabled.find((task) => task.id === iniciado.id)?.status).toBe('in_progress')

    // 8. Reativar devolve sprint, histórico e itens como estavam.
    const backlogBefore = ids(await useCases.backlog.list.execute(ctx(ana), { projectId }))
    await setProject(c, { sprints: 'active' })
    expect(await stateOf(c, 'sprints')).toBe('active')
    const back = await useCases.sprints.get.execute(ctx(ana), { sprintId: sprint.sprint.id })
    expect(back.sprint).toMatchObject({ status: 'closed', closePolicy: 'return_to_backlog' })
    expect(new Map(back.history.map((row) => [row.taskId, row.outcome]))).toEqual(outcomes)
    expect(ids(await useCases.backlog.list.execute(ctx(ana), { projectId }))).toEqual(backlogBefore)
    const draftBack = await useCases.sprints.get.execute(ctx(ana), { sprintId: draft.sprint.id })
    expect(draftBack.sprint.status).toBe('draft')

    // 9. A linha do módulo no projeto guarda quem mudou por último. A trilha de auditoria dos
    // módulos do projeto ainda não existe (lacuna registrada); a da equipe segue em team-tools.test.ts.
    const row = (await c.repos.projectModules.list(orgA, projectId)).find(
      (setting) => setting.moduleId === 'sprints',
    )
    expect(row).toMatchObject({ state: 'active', changedBy: managerId })
  })

  it('o time B não enxerga nem altera a sprint do time A durante o encerramento', async () => {
    const c = await setup()
    const sprint = await c.useCases.sprints.create.execute(ctx(ana), {
      projectId,
      plannedStart: '2026-11-16',
      plannedEnd: '2026-11-27',
    })
    await setProject(c, Object.fromEntries(SPRINT_CHAIN.map((id) => [id, 'winding_down'])))
    await expect(
      c.useCases.sprints.get.execute(ctx(managerB), { sprintId: sprint.sprint.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(c.useCases.teamTools.get.execute(ctx(managerB))).resolves.toBeDefined()
    expect(await teamStateOf(c, 'sprints', managerB)).toBe('active')
  })
})

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id)
}
