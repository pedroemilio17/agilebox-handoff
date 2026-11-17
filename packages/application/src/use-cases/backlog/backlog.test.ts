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
import type { ActorSession } from '../../ports'
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

async function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const repos = unitOfWork.repositories
  for (const [id, name, prefix] of [
    [orgA, 'Time A', 'AAA'],
    [orgB, 'Time B', 'BBB'],
  ] as const)
    await repos.organizations.save(
      createOrganization({ id, name, taskPrefix: prefix, createdAt: '2026-01-01T00:00:00.000Z' }),
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
  const actorSession: ActorSession = { get: () => ana, set: () => undefined }
  const notifier = new RecordingNotifier()
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock(NOW),
    boardSettings: repos.boardSettings,
    checklist: repos.checklist,
    acceptance: repos.acceptance,
    comments: repos.comments,
    contributors: repos.contributors,
    dailyEntries: repos.dailyEntries,
    teamTools: repos.teamTools,
    sprints: repos.sprints,
    sprintTasks: repos.sprintTasks,
    impediments: repos.impediments,
    definitionOfDone: repos.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: repos.meetings,
    organizations: repos.organizations,
    participations: repos.participations,
    projects: repos.projects,
    retroActions: repos.retroActions,
    taskOpens: repos.taskOpens,
    tasks: repos.tasks,
    timeline: repos.timeline,
    unitOfWork,
    users: repos.users,
  })
  // O módulo `backlog` é de Intermediário para cima: a equipe de teste já o tem ligado.
  await useCases.teamTools.applyChange.execute(ctx(manager), { enable: ['backlog'] })
  return { useCases, repos, notifier }
}

type Ctx = Awaited<ReturnType<typeof setup>>
const add = (c: Ctx, actor: Actor, title: string) =>
  c.useCases.backlog.add.execute(ctx(actor), { projectId, title })
const ids = (tasks: readonly { id: string }[]) => tasks.map((task) => task.id)
const backlogIds = async (c: Ctx, actor: Actor = manager) =>
  ids(await c.useCases.backlog.list.execute(ctx(actor), { projectId }))

async function eventsOf(c: Ctx, taskId: string): Promise<readonly TimelineEvent[]> {
  return c.repos.timeline.listByTask(orgA, toTaskId(taskId))
}

describe('backlog: criar, listar e a visibilidade no quadro', () => {
  it('backlog.add cria em Planejamento, fora do quadro, e registra a entrada no backlog', async () => {
    const c = await setup()
    const dto = await add(c, ana, 'Relatório mensal')
    expect(dto).toMatchObject({ status: 'planning', inBacklog: true })
    expect(dto.backlogRank).not.toBeNull()

    expect(await backlogIds(c, ana)).toEqual([dto.id])
    const board = await c.useCases.tasks.listBoard.execute(ctx(ana), {})
    expect(ids(board.tasks)).not.toContain(dto.id)

    const types = (await eventsOf(c, dto.id)).map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['task_created', 'task_added_to_backlog']))
  })

  it('backlog.add recusa projeto arquivado e quem não é membro', async () => {
    const c = await setup()
    await expect(
      c.useCases.backlog.add.execute(ctx(bruno), { projectId, title: 'X' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await c.useCases.projects.archive.execute(ctx(manager), { projectId })
    await expect(add(c, manager, 'Y')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('item de backlog some do quadro, da busca, de recentes e frequentes, e volta ao ser puxado', async () => {
    const c = await setup()
    const dto = await add(c, ana, 'Relatório semanal')
    await c.useCases.tasks.recordOpen.execute(ctx(ana), { taskId: dto.id })

    expect(ids((await c.useCases.tasks.listBoard.execute(ctx(ana), {})).tasks)).not.toContain(
      dto.id,
    )
    expect(ids(await c.useCases.tasks.search.execute(ctx(ana), { query: 'Relatório' }))).toEqual([])
    expect(ids(await c.useCases.tasks.listRecent.execute(ctx(ana)))).not.toContain(dto.id)
    expect(ids(await c.useCases.tasks.listFrequent.execute(ctx(ana)))).not.toContain(dto.id)
    expect(ids(await c.useCases.tasks.listTeamBoard.execute(ctx(manager), {}))).not.toContain(
      dto.id,
    )

    // Abrir o detalhe continua funcionando: o item é uma tarefa normal.
    await expect(
      c.useCases.tasks.getDetail.execute(ctx(ana), { taskId: dto.id }),
    ).resolves.toMatchObject({ inBacklog: true, canEdit: true })

    const pulled = await c.useCases.backlog.pull.execute(ctx(ana), { taskId: dto.id })
    expect(pulled).toMatchObject({ status: 'todo', inBacklog: false, backlogRank: null })
    expect(ids((await c.useCases.tasks.listBoard.execute(ctx(ana), {})).tasks)).toContain(dto.id)
    expect(ids(await c.useCases.tasks.search.execute(ctx(ana), { query: 'Relatório' }))).toContain(
      dto.id,
    )
    expect(ids(await c.useCases.tasks.listRecent.execute(ctx(ana)))).toContain(dto.id)
    expect(ids(await c.useCases.tasks.listFrequent.execute(ctx(ana)))).toContain(dto.id)
    expect(await backlogIds(c, ana)).toEqual([])
  })

  it('o dashboard do gestor não conta item de backlog', async () => {
    const c = await setup()
    await c.useCases.tasks.create.execute(ctx(ana), { projectId, title: 'No quadro' })
    const before = await c.useCases.dashboard.get.execute(ctx(manager))
    await add(c, ana, 'Só no backlog')
    const after = await c.useCases.dashboard.get.execute(ctx(manager))
    const countOf = (dashboard: typeof before) =>
      dashboard.collaborators.find((stat) => stat.user.name === 'Ana')?.taskCount
    expect(countOf(after)).toBe(countOf(before))
    expect(countOf(after)).toBe(1)
  })
})

describe('backlog: devolver ao backlog e as recusas', () => {
  it('devolve tarefa em A fazer ao backlog: estado vira Planejamento, fica no fim, com linha do tempo', async () => {
    const c = await setup()
    const onBoard = await c.useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'Ainda não começou',
      status: 'todo',
    })
    const sent = await c.useCases.backlog.sendBack.execute(ctx(ana), { taskId: onBoard.id })
    expect(sent).toMatchObject({ status: 'planning', inBacklog: true })
    expect(await backlogIds(c, ana)).toEqual([onBoard.id])
    const types = (await eventsOf(c, onBoard.id)).map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['task_sent_to_backlog', 'status_changed']))
  })

  it('recusa devolver tarefa em andamento, revisão ou concluída, com conflito e mensagem clara', async () => {
    const c = await setup()
    for (const status of ['in_progress', 'review', 'done'] as const) {
      const started = await c.useCases.tasks.create.execute(ctx(ana), {
        projectId,
        title: `Tarefa ${status}`,
        status,
      })
      await expect(
        c.useCases.backlog.sendBack.execute(ctx(ana), { taskId: started.id }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(
        c.useCases.backlog.sendBack.execute(ctx(ana), { taskId: started.id }),
      ).rejects.toThrow('já começou')
    }
  })

  it('recusa devolver item que já está no backlog, e puxar tarefa que não está nele', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Já no backlog')
    await expect(
      c.useCases.backlog.sendBack.execute(ctx(ana), { taskId: item.id }),
    ).rejects.toThrow('já está no backlog')
    const onBoard = await c.useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'No quadro',
    })
    await expect(c.useCases.backlog.pull.execute(ctx(ana), { taskId: onBoard.id })).rejects.toThrow(
      'não está no backlog',
    )
  })

  it('puxar para Planejamento é recusado, e puxar sem estado vai para A fazer', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Puxar')
    await expect(
      c.useCases.backlog.pull.execute(ctx(ana), { taskId: item.id, status: 'planning' as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const pulled = await c.useCases.backlog.pull.execute(ctx(ana), {
      taskId: item.id,
      status: 'in_progress',
    })
    expect(pulled.status).toBe('in_progress')
  })

  it('item de backlog não muda de coluna por tasks.move: é recusado até ser puxado', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Sem coluna')
    await expect(
      c.useCases.tasks.move.execute(ctx(ana), { taskId: item.id, status: 'todo' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      c.useCases.tasks.move.execute(ctx(ana), { taskId: item.id, status: 'planning' }),
    ).resolves.toMatchObject({ status: 'planning', inBacklog: true })
  })
})

describe('backlog: reordenação persiste', () => {
  it('reordena para o topo, para o fim e entre vizinhos, e a lista segue a ordem gravada', async () => {
    const c = await setup()
    const a = await add(c, ana, 'A')
    const b = await add(c, ana, 'B')
    const d = await add(c, ana, 'C')
    expect(await backlogIds(c, ana)).toEqual([a.id, b.id, d.id])

    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: d.id, position: 'top' })
    expect(await backlogIds(c, ana)).toEqual([d.id, a.id, b.id])

    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: a.id, afterId: d.id })
    expect(await backlogIds(c, ana)).toEqual([d.id, a.id, b.id])

    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: b.id, beforeId: d.id })
    expect(await backlogIds(c, ana)).toEqual([b.id, d.id, a.id])

    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: b.id, position: 'end' })
    expect(await backlogIds(c, ana)).toEqual([d.id, a.id, b.id])
  })

  it('reordenar sem mudar de lugar não grava nem registra evento', async () => {
    const c = await setup()
    const a = await add(c, ana, 'A')
    await add(c, ana, 'B')
    const before = (await eventsOf(c, a.id)).length
    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: a.id, position: 'top' })
    expect((await eventsOf(c, a.id)).length).toBe(before)
  })

  it('repetir a reordenação entre os mesmos vizinhos renumera sem perder a ordem', async () => {
    const c = await setup()
    const first = await add(c, ana, 'Primeiro')
    const last = await add(c, ana, 'Último')
    const inserted: string[] = []
    // Cada item novo entra logo depois do primeiro: os espaços entre eles se esgotam e o backlog é renumerado.
    for (let index = 0; index < 14; index += 1) {
      const item = await add(c, ana, `Item ${index}`)
      inserted.push(item.id)
      await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: item.id, afterId: first.id })
    }
    expect(await backlogIds(c, ana)).toEqual([first.id, ...[...inserted].reverse(), last.id])
  })

  it('registra a reordenação na linha do tempo com a posição e a marca Gestor quando o gestor mexe', async () => {
    const c = await setup()
    const a = await add(c, ana, 'A')
    const b = await add(c, ana, 'B')
    await c.useCases.backlog.reorder.execute(ctx(manager), { taskId: b.id, position: 'top' })
    const reordered = (await eventsOf(c, b.id)).filter((event) => event.type === 'task_reordered')
    expect(reordered).toEqual([
      expect.objectContaining({
        asManager: true,
        actorUserId: managerId,
        payload: { position: 1 },
      }),
    ])
    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: a.id, position: 'top' })
    expect(
      (await eventsOf(c, a.id)).find((event) => event.type === 'task_reordered'),
    ).toMatchObject({ asManager: false })
  })

  it('reordenar com vizinho que não está no backlog, ou com a própria tarefa, é recusado', async () => {
    const c = await setup()
    const a = await add(c, ana, 'A')
    await expect(
      c.useCases.backlog.reorder.execute(ctx(ana), { taskId: a.id, afterId: a.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      c.useCases.backlog.reorder.execute(ctx(ana), {
        taskId: a.id,
        afterId: '01ARZ3NDEKTSV4RRFFQ69G5FZZ',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('backlog: acesso (membro, não membro e gestor)', () => {
  it('não membro não vê, não reordena, não puxa, não devolve e não cria no backlog do projeto', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Do projeto')
    await expect(c.useCases.backlog.list.execute(ctx(bruno), { projectId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      c.useCases.backlog.reorder.execute(ctx(bruno), { taskId: item.id, position: 'top' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      c.useCases.backlog.pull.execute(ctx(bruno), { taskId: item.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      c.useCases.backlog.sendBack.execute(ctx(bruno), { taskId: item.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('membro do projeto reordena e puxa item que ele não criou nem participa', async () => {
    const c = await setup()
    const item = await add(c, manager, 'Criado pela gestora')
    // Ana é membro do projeto mas não participa desta tarefa: pode reordenar e puxar.
    await c.useCases.backlog.reorder.execute(ctx(ana), { taskId: item.id, position: 'top' })
    await expect(
      c.useCases.backlog.pull.execute(ctx(ana), { taskId: item.id }),
    ).resolves.toMatchObject({
      status: 'todo',
    })
    // Mas o conteúdo segue a regra da edição: quem não participa não edita.
    const other = await add(c, manager, 'Conteúdo')
    await expect(
      c.useCases.tasks.update.execute(ctx(ana), { taskId: other.id, changes: { title: 'Outro' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('o gestor mexe em tudo do backlog e a linha do tempo marca Gestor; o colaborador não', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Da Ana')
    await c.useCases.backlog.pull.execute(ctx(manager), { taskId: item.id })
    const pulled = (await eventsOf(c, item.id)).find(
      (event) => event.type === 'task_pulled_from_backlog',
    )
    expect(pulled).toMatchObject({ asManager: true, actorUserId: managerId })

    const second = await add(c, ana, 'Da Ana 2')
    await c.useCases.backlog.pull.execute(ctx(ana), { taskId: second.id })
    expect(
      (await eventsOf(c, second.id)).find((event) => event.type === 'task_pulled_from_backlog'),
    ).toMatchObject({ asManager: false })
  })
})

describe('backlog: isolamento, arquivamento e módulo', () => {
  it('outra organização não vê o backlog daqui nem reordena os itens', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Só do time A')
    await expect(
      c.useCases.backlog.list.execute(ctx(managerB), { projectId }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      c.useCases.backlog.reorder.execute(ctx(managerB), { taskId: item.id, position: 'top' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      c.useCases.backlog.pull.execute(ctx(managerB), { taskId: item.id }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('projeto arquivado: os itens saem da lista padrão e o backlog não recebe item novo', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Antes do arquivo')
    await c.useCases.projects.archive.execute(ctx(manager), { projectId })
    expect(await backlogIds(c, manager)).toEqual([])
    expect(
      ids(
        await c.useCases.backlog.list.execute(ctx(manager), { projectId, includeArchived: true }),
      ),
    ).toEqual([item.id])
    await expect(add(c, manager, 'Depois')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('tarefa arquivada do backlog não muda de lugar nem sai: é conflito até desarquivar', async () => {
    const c = await setup()
    const first = await add(c, ana, 'Um')
    const second = await add(c, ana, 'Dois')
    await c.useCases.tasks.archive.execute(ctx(ana), { taskId: first.id })
    expect(await backlogIds(c, ana)).toEqual([second.id])
    await expect(
      c.useCases.backlog.reorder.execute(ctx(ana), { taskId: first.id, position: 'top' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      c.useCases.backlog.pull.execute(ctx(ana), { taskId: first.id }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('módulo backlog: encerrando não aceita item novo, mas deixa puxar; desativado recusa tudo', async () => {
    const c = await setup()
    const item = await add(c, ana, 'Antes de encerrar')
    // Sprints depende de Backlog, e Burndown e Revisão dependem de Sprints: o domínio recusa desligar só um.
    const chain = ['burndown', 'reviewRetro', 'sprints', 'backlog'] as const
    await c.useCases.teamTools.applyChange.execute(ctx(manager), { disable: [...chain] })

    await expect(add(c, ana, 'Novo')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(add(c, manager, 'Gestora')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(c.useCases.backlog.list.execute(ctx(ana), { projectId })).resolves.toHaveLength(1)
    await expect(
      c.useCases.backlog.pull.execute(ctx(ana), { taskId: item.id }),
    ).resolves.toMatchObject({
      status: 'todo',
    })

    await c.useCases.teamTools.applyChange.execute(ctx(manager), {
      disable: [...chain],
      finalize: [...chain],
    })
    await expect(c.useCases.backlog.list.execute(ctx(ana), { projectId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      c.useCases.backlog.reorder.execute(ctx(ana), { taskId: item.id, position: 'top' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
