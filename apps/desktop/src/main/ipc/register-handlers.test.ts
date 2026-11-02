import { describe, expect, it, vi } from 'vitest'
import {
  API_CHANNELS,
  EXPERIENCE_LEVEL_IDS,
  SIDEBAR_SCREEN_IDS as CONTRACT_SCREEN_IDS,
  TEAM_MODULE_IDS,
} from '@agilebox/contract'
import type { ApiResult } from '@agilebox/contract'
import { criteriaViewOutputSchema, getTaskOutputSchema, taskDtoSchema } from '@agilebox/contract'
import {
  EXPERIENCE_LEVELS,
  MODULE_IDS,
  SIDEBAR_SCREEN_IDS as CORE_SCREEN_IDS,
  sendToBacklog,
  setEstimatedHours,
  toOrganizationId,
  toParticipationId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, Task, User } from '@agilebox/core'
import { createUseCases } from '@agilebox/application'
import type { ActorSession } from '@agilebox/application'
import {
  FixedClock,
  InMemoryUnitOfWork,
  RecordingNotifier,
  SequentialIdGenerator,
  aParticipation,
  aProject,
  aTask,
  aUser,
} from '@agilebox/application/testing'
import { registerHandlers } from './register-handlers'

const organizationId = toOrganizationId('00000000000000000000000001')
const collaborator: Actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId,
  role: 'collaborator',
}
const manager: Actor = {
  userId: toUserId('00000000000000000000000003'),
  organizationId,
  role: 'manager',
}

type Handler = (event: unknown, input: unknown) => Promise<ApiResult<unknown>>

/** Usa os casos de uso reais sobre repositórios em memória e captura os handlers registrados. */
function handlersFor(actor: Actor, unitOfWork = new InMemoryUnitOfWork()) {
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-20T12:00:00.000Z'),
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
  const handlers = new Map<string, Handler>()
  registerHandlers(
    { handle: (channel, listener) => handlers.set(channel, listener as Handler) },
    useCases,
    actorSession,
  )
  return (channel: string, input?: unknown) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Canal sem handler: ${channel}`)
    return handler({}, input)
  }
}

describe('registro dos handlers IPC', () => {
  it('registra exatamente um handler para cada canal da API', () => {
    const registered: string[] = []
    const ipcMain = {
      handle: (channel: string) => registered.push(channel),
    }

    registerHandlers(ipcMain, {} as Parameters<typeof registerHandlers>[1], {
      get: vi.fn(() => ({
        userId: toUserId('00000000000000000000000002'),
        organizationId: toOrganizationId('00000000000000000000000001'),
        role: 'collaborator' as const,
      })),
      set: vi.fn(),
    })

    expect(registered).toHaveLength(API_CHANNELS.length)
    expect(new Set(registered)).toEqual(new Set(API_CHANNELS))
  })
})

describe('handlers de ferramentas do time', () => {
  it('lista de ids do contrato é igual à do catálogo do core', () => {
    expect([...TEAM_MODULE_IDS]).toEqual([...MODULE_IDS])
  })

  it('níveis e telas do menu no contrato são iguais aos do core, na mesma ordem', () => {
    expect([...EXPERIENCE_LEVEL_IDS]).toEqual([...EXPERIENCE_LEVELS])
    expect([...CONTRACT_SCREEN_IDS]).toEqual([...CORE_SCREEN_IDS])
  })

  it('recusa colaborador em mudança, prévia e conclusão de encerramento', async () => {
    const call = handlersFor(collaborator)

    for (const [channel, input] of [
      ['teamModules.change', { disable: ['agenda'] }],
      ['teamModules.previewImpact', { disable: ['agenda'] }],
      ['teamModules.finishWindingDown', { moduleId: 'agenda' }],
    ] as const) {
      const result = await call(channel, input)
      expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    }
  })

  it('deixa o colaborador ler as ferramentas, sem permissão de alterá-las', async () => {
    const result = await handlersFor(collaborator)('teamModules.get')

    expect(result).toMatchObject({ ok: true })
  })

  it('colaborador não recebe Ferramentas nem Dashboard nas telas do menu', async () => {
    const result = await handlersFor(collaborator)('teamModules.get')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { level: string; screens: string[] }
    expect(value.level).toBe('intermediate')
    expect(value.screens).not.toContain('tools')
    expect(value.screens).not.toContain('dashboard')
    expect(value.screens).toEqual(['projects', 'agenda'])
  })

  it('gestor recebe Dashboard, mas não Ferramentas nem Impedimentos no nível padrão', async () => {
    const call = handlersFor(manager)
    await call('teamModules.change', { enable: ['backlog'] })

    const result = await call('teamModules.get')

    expect(result).toMatchObject({
      ok: true,
      value: { level: 'intermediate', screens: ['projects', 'agenda', 'backlog', 'dashboard'] },
    })
  })

  it('ferramenta desligada some das telas do menu', async () => {
    const call = handlersFor(manager)
    await call('teamModules.change', { disable: ['agenda'] })

    const result = await call('teamModules.get')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { screens: string[] }
    expect(value.screens).not.toContain('agenda')
    expect(value.screens).toContain('projects')
  })

  it('recusa id desconhecido antes de chegar ao caso de uso', async () => {
    const call = handlersFor(manager)

    await expect(call('teamModules.change', { enable: ['marte'] })).resolves.toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'Entrada inválida' },
    })
  })

  it('aplica a mudança pedida pelo gestor e devolve os estados', async () => {
    const result = await handlersFor(manager)('teamModules.change', { enable: ['backlog'] })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value as { statuses: { moduleId: string; state: string }[] }
    expect(value.statuses).toContainEqual({ moduleId: 'backlog', state: 'active' })
    expect(value).toMatchObject({ windingDown: [] })
  })
})

describe('handlers do nível do time (M2.9b)', () => {
  it('o nível começa no sugerido (Padrão), e o colaborador consegue ler', async () => {
    await expect(handlersFor(collaborator)('teamSettings.getLevel')).resolves.toEqual({
      ok: true,
      value: 'intermediate',
    })
  })

  it('gestor grava o nível e teamModules.get passa a devolver o gravado (Avançado mostra Ferramentas)', async () => {
    const call = handlersFor(manager)

    await expect(call('teamSettings.setLevel', { level: 'advanced' })).resolves.toEqual({
      ok: true,
      value: 'advanced',
    })

    const result = await call('teamModules.get')
    expect(result).toMatchObject({ ok: true, value: { level: 'advanced' } })
    if (!result.ok) return
    expect((result.value as { screens: string[] }).screens).toContain('tools')
  })

  it('colaborador não grava: a tentativa é recusada e o nível que o gestor gravou continua valendo', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const asManager = handlersFor(manager, unitOfWork)
    const asCollaborator = handlersFor(collaborator, unitOfWork)
    await asManager('teamSettings.setLevel', { level: 'basic' })

    const attempt = await asCollaborator('teamSettings.setLevel', { level: 'advanced' })

    expect(attempt).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(await asCollaborator('teamSettings.getLevel')).toEqual({ ok: true, value: 'basic' })
    expect(await asManager('teamSettings.getLevel')).toEqual({ ok: true, value: 'basic' })
  })

  it('nível fora do catálogo é recusado pelo schema, antes do caso de uso', async () => {
    await expect(
      handlersFor(manager)('teamSettings.setLevel', { level: 'expert' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'Entrada inválida' },
    })
  })

  it('no nível gravado Essencial, Backlog ligado não aparece no menu', async () => {
    const call = handlersFor(manager)
    await call('teamModules.change', { enable: ['backlog'] })
    await call('teamSettings.setLevel', { level: 'basic' })

    const result = await call('teamModules.get')

    expect(result).toMatchObject({ ok: true, value: { level: 'basic' } })
    if (!result.ok) return
    const value = result.value as { screens: string[]; statuses: { moduleId: string }[] }
    expect(value.screens).not.toContain('backlog')
    expect(value.statuses).toContainEqual({ moduleId: 'backlog', state: 'active' })
  })
})

describe('tasks.listArchived pelo IPC (M3.0b)', () => {
  it('colaborador recebe só as arquivadas em que participa; gestor recebe todas', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const me = aUser().build()
    const bia = aUser()
      .with({ id: toUserId('00000000000000000000000009'), name: 'Bia Lima' })
      .build()
    await unitOfWork.repositories.users.save(organizationId, me)
    await unitOfWork.repositories.users.save(organizationId, bia)
    await unitOfWork.repositories.projects.save(organizationId, aProject().build())
    const mine = {
      ...aTask()
        .with({ id: toTaskId('00000000000000000000000031'), title: 'Minha arquivada' })
        .build(),
      archivedAt: '2026-01-03T00:00:00.000Z',
    }
    const theirs = {
      ...aTask()
        .with({ id: toTaskId('00000000000000000000000032'), title: 'Alheia arquivada' })
        .ownedBy(bia)
        .build(),
      archivedAt: '2026-01-04T00:00:00.000Z',
    }
    await unitOfWork.repositories.tasks.save(organizationId, mine)
    await unitOfWork.repositories.tasks.save(organizationId, theirs)

    await expect(
      handlersFor(collaborator, unitOfWork)('tasks.listArchived'),
    ).resolves.toMatchObject({
      ok: true,
      value: [{ title: 'Minha arquivada' }],
    })
    await expect(handlersFor(manager, unitOfWork)('tasks.listArchived')).resolves.toMatchObject({
      ok: true,
      value: [{ title: 'Alheia arquivada' }, { title: 'Minha arquivada' }],
    })
  })
})

describe('handlers do backlog pelo IPC (M3.10a)', () => {
  const otherOrganizationId = toOrganizationId('00000000000000000000000009')
  const taskIdOf = (n: number) => toTaskId(String(n).padStart(26, '0'))

  /** Tarefa do time; `rank` nulo deixa a tarefa no quadro. */
  function aTeamTask(n: number, rank: number | null, org = organizationId) {
    const task = aTask()
      .with({ id: taskIdOf(n), organizationId: org, title: `Tarefa ${n}` })
      .build()
    return rank === null ? task : sendToBacklog(task, rank)
  }

  it('gestor reordena e a lista do backlog devolve a nova ordem 1..n', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['backlog'] })
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(41, 1))
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(42, 2))

    await expect(
      call('backlog.reorder', { taskId: taskIdOf(42), placement: 'top' }),
    ).resolves.toEqual({ ok: true, value: undefined })

    const listed = await call('backlog.list', {})
    expect(listed).toMatchObject({
      ok: true,
      value: [
        { id: taskIdOf(42), backlogRank: 1, onBoard: false },
        { id: taskIdOf(41), backlogRank: 2, onBoard: false },
      ],
    })
  })

  it('colaborador recebe FORBIDDEN ao reordenar e a ordem não muda', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const asManager = handlersFor(manager, unitOfWork)
    const asCollaborator = handlersFor(collaborator, unitOfWork)
    await asManager('teamModules.change', { enable: ['backlog'] })
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(41, 1))
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(42, 2))

    await expect(
      asCollaborator('backlog.reorder', { taskId: taskIdOf(42), placement: 'top' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Só o gestor reordena o backlog' },
    })
    await expect(asManager('backlog.list', {})).resolves.toMatchObject({
      ok: true,
      value: [
        { id: taskIdOf(41), backlogRank: 1 },
        { id: taskIdOf(42), backlogRank: 2 },
      ],
    })
  })

  it('com o módulo Backlog desligado, reordenar é recusado citando o módulo', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['backlog'] })
    const change = await call('teamModules.change', { disable: ['backlog'] })
    if (!change.ok) throw new Error('Desligar o backlog deveria funcionar')
    const statuses = (change.value as { statuses: { moduleId: string; state: string }[] }).statuses
    expect(statuses).toContainEqual({ moduleId: 'backlog', state: 'disabled' })
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(41, 1))

    const result = await call('backlog.reorder', { taskId: taskIdOf(41), placement: 'end' })

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    if (result.ok) return
    expect(result.error.message).toContain('Backlog')
  })

  it('tarefa de outro time vira NotFound ao reordenar e ao levar ao quadro', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['backlog'] })
    await unitOfWork.repositories.tasks.save(
      otherOrganizationId,
      aTeamTask(77, 1, otherOrganizationId),
    )

    await expect(
      call('backlog.reorder', { taskId: taskIdOf(77), placement: 'top' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    await expect(call('backlog.takeToBoard', { taskId: taskIdOf(77) })).resolves.toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('recusa identificador malformado e posição inválida antes do caso de uso', async () => {
    const call = handlersFor(manager)

    for (const input of [
      { taskId: 'tarefa-1', placement: 'top' },
      { taskId: taskIdOf(41), placement: -1 },
      { taskId: taskIdOf(41), placement: 1.5 },
    ]) {
      await expect(call('backlog.reorder', input)).resolves.toEqual({
        ok: false,
        error: { code: 'VALIDATION', message: 'Entrada inválida' },
      })
    }
    await expect(call('backlog.takeToBoard', { taskId: 'tarefa-1' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    })
  })

  it('leva ao quadro e devolve ao backlog pelo IPC, com onBoard e backlogRank no DTO', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['backlog'] })
    await unitOfWork.repositories.tasks.save(organizationId, aTeamTask(41, 1))

    await expect(call('backlog.takeToBoard', { taskId: taskIdOf(41) })).resolves.toMatchObject({
      ok: true,
      value: { id: taskIdOf(41), onBoard: true, backlogRank: null, status: 'planning' },
    })
    await expect(call('backlog.sendToBacklog', { taskId: taskIdOf(41) })).resolves.toMatchObject({
      ok: true,
      value: { id: taskIdOf(41), onBoard: false, backlogRank: 1, status: 'planning' },
    })
  })

  it('tasks.create com inBacklog nasce no fim do backlog, fora do quadro', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.users.save(
      organizationId,
      aUser().with({ id: manager.userId, name: 'Bia Gestora' }).build(),
    )
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['backlog'] })

    await expect(
      call('tasks.create', { projectId: project.id, title: 'Nova no backlog', inBacklog: true }),
    ).resolves.toMatchObject({
      ok: true,
      value: { title: 'Nova no backlog', onBoard: false, backlogRank: 1, status: 'planning' },
    })
  })
})

describe('critérios de aceite e estimativa pelo IPC (M3.8b)', () => {
  const taskIdOf = (n: number) => toTaskId(String(n).padStart(26, '0'))

  async function seedTeam(unitOfWork: InMemoryUnitOfWork) {
    const ana = aUser().with({ id: collaborator.userId, name: 'Ana Lima' }).build()
    const bia = aUser().with({ id: manager.userId, name: 'Bia Gestora' }).build()
    await unitOfWork.repositories.users.save(organizationId, ana)
    await unitOfWork.repositories.users.save(organizationId, bia)
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    return { ana, bia, project }
  }

  function taskOwnedBy(n: number, owner: User, projectId: Task['projectId']) {
    return aTask()
      .with({ id: taskIdOf(n), organizationId, projectId, title: `Tarefa ${n}` })
      .ownedBy(owner)
      .build()
  }

  type Criteria = { criteria: { id: string; text: string; done: boolean }[]; summary: unknown }

  /** Valor de um resultado bem-sucedido; falha o teste se o resultado for erro. */
  function okValue<T>(result: ApiResult<unknown>): T {
    if (!result.ok)
      throw new Error(`Esperado sucesso, veio ${result.error.code}: ${result.error.message}`)
    return result.value as T
  }

  it('colaborador participante acrescenta, marca e a resposta bate com o contrato', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { ana, project } = await seedTeam(unitOfWork)
    const asManager = handlersFor(manager, unitOfWork)
    const asCollaborator = handlersFor(collaborator, unitOfWork)
    await asManager('teamModules.change', { enable: ['backlog', 'acceptance'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(61, ana, project.id))

    const added = await asCollaborator('acceptance.add', {
      taskId: taskIdOf(61),
      text: '  Login com e-mail  ',
    })
    expect(criteriaViewOutputSchema.safeParse(okValue(added)).success).toBe(true)
    const first = okValue<Criteria>(added).criteria[0]!
    expect(first).toMatchObject({ text: 'Login com e-mail', done: false })

    const marked = await asCollaborator('acceptance.setDone', {
      taskId: taskIdOf(61),
      criterionId: first.id,
      done: true,
    })
    expect(okValue(marked)).toMatchObject({ summary: { done: 1, total: 1 } })
  })

  it('colaborador participante edita, remove e reordena critérios', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { ana, project } = await seedTeam(unitOfWork)
    const call = handlersFor(collaborator, unitOfWork)
    await handlersFor(manager, unitOfWork)('teamModules.change', {
      enable: ['backlog', 'acceptance'],
    })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(62, ana, project.id))
    const taskId = taskIdOf(62)
    const one = okValue<Criteria>(await call('acceptance.add', { taskId, text: 'Primeiro' }))
    const two = okValue<Criteria>(await call('acceptance.add', { taskId, text: 'Segundo' }))
    const firstId = one.criteria[0]!.id
    const secondId = two.criteria[1]!.id

    const reordered = okValue<Criteria>(
      await call('acceptance.reorder', { taskId, criterionId: secondId, toIndex: 0 }),
    )
    expect(reordered.criteria.map((c) => c.text)).toEqual(['Segundo', 'Primeiro'])

    const edited = okValue<Criteria>(
      await call('acceptance.edit', { taskId, criterionId: firstId, text: 'Primeiro, revisado' }),
    )
    expect(edited.criteria.map((c) => c.text)).toEqual(['Segundo', 'Primeiro, revisado'])

    const removed = okValue<Criteria>(
      await call('acceptance.remove', { taskId, criterionId: secondId }),
    )
    expect(removed.criteria.map((c) => c.text)).toEqual(['Primeiro, revisado'])
    expect(okValue(await call('acceptance.list', { taskId }))).toMatchObject({
      summary: { done: 0, total: 1 },
    })
  })

  it('colaborador que não participa recebe FORBIDDEN ao editar e ao ler os critérios', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    const asManager = handlersFor(manager, unitOfWork)
    await asManager('teamModules.change', { enable: ['backlog', 'acceptance'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(63, bia, project.id))
    const asCollaborator = handlersFor(collaborator, unitOfWork)

    await expect(
      asCollaborator('acceptance.add', { taskId: taskIdOf(63), text: 'Intruso' }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem permissão para editar os critérios desta tarefa' },
    })
    await expect(
      asCollaborator('acceptance.list', { taskId: taskIdOf(63) }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(
      okValue<Criteria>(await asManager('acceptance.list', { taskId: taskIdOf(63) })).criteria,
    ).toEqual([])
  })

  it('gestor edita critério de tarefa de colaborador (a edição vale para o gestor também)', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { ana, project } = await seedTeam(unitOfWork)
    const asManager = handlersFor(manager, unitOfWork)
    await asManager('teamModules.change', { enable: ['backlog', 'acceptance'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(64, ana, project.id))

    const added = await asManager('acceptance.add', {
      taskId: taskIdOf(64),
      text: 'Revisado pelo gestor',
    })

    expect(okValue(added)).toMatchObject({
      criteria: [{ text: 'Revisado pelo gestor', done: false }],
      summary: { done: 0, total: 1 },
    })
  })

  it('com o módulo Aceite desligado, critérios são recusados citando o nome, para qualquer papel', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { ana, project } = await seedTeam(unitOfWork)
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(65, ana, project.id))

    for (const actor of [manager, collaborator]) {
      const result = await handlersFor(actor, unitOfWork)('acceptance.add', {
        taskId: taskIdOf(65),
        text: 'Sem módulo',
      })
      expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
      if (result.ok) return
      expect(result.error.message).toContain('Aceite')
    }
  })

  it('recusa texto inválido, índice negativo e id malformado antes do caso de uso', async () => {
    const call = handlersFor(manager)

    for (const [channel, input] of [
      ['acceptance.add', { taskId: taskIdOf(66), text: '   ' }],
      ['acceptance.add', { taskId: taskIdOf(66), text: 'a'.repeat(201) }],
      ['acceptance.add', { taskId: 'tarefa-1', text: 'Critério' }],
      ['acceptance.edit', { taskId: taskIdOf(66), criterionId: 'criterio-1', text: 'Critério' }],
      ['acceptance.setDone', { taskId: taskIdOf(66), criterionId: taskIdOf(67), done: 'sim' }],
      ['acceptance.reorder', { taskId: taskIdOf(66), criterionId: taskIdOf(67), toIndex: -1 }],
    ] as const) {
      await expect(call(channel, input)).resolves.toEqual({
        ok: false,
        error: { code: 'VALIDATION', message: 'Entrada inválida' },
      })
    }
  })

  it('gestor define a estimativa em horas; o DTO devolve horas decimais e custo em R$', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['estimates.hours'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(71, bia, project.id))

    const set = await call('estimates.set', { taskId: taskIdOf(71), estimatedHours: 2.5 })

    expect(set).toMatchObject({
      ok: true,
      value: { id: taskIdOf(71), estimatedHours: 2.5, estimatedCost: 112.5, realizedCost: 0 },
    })
    expect(taskDtoSchema.safeParse(okValue(set)).success).toBe(true)
  })

  it('converte horas decimais em centésimos sem erro de ponto flutuante (0,29 h = 29 centésimos)', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['estimates.hours'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(72, bia, project.id))

    await expect(
      call('estimates.set', { taskId: taskIdOf(72), estimatedHours: 0.29 }),
    ).resolves.toMatchObject({
      ok: true,
      value: { estimatedHours: 0.29 },
    })
    await expect(
      call('estimates.set', { taskId: taskIdOf(72), estimatedHours: 1.1 }),
    ).resolves.toMatchObject({
      ok: true,
      value: { estimatedHours: 1.1, estimatedCost: 49.5 },
    })
  })

  it('nulo limpa a estimativa e o custo estimado volta a nulo', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    const call = handlersFor(manager, unitOfWork)
    await call('teamModules.change', { enable: ['estimates.hours'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(73, bia, project.id))
    await call('estimates.set', { taskId: taskIdOf(73), estimatedHours: 3 })

    await expect(
      call('estimates.set', { taskId: taskIdOf(73), estimatedHours: null }),
    ).resolves.toMatchObject({
      ok: true,
      value: { estimatedHours: null, estimatedCost: null },
    })
  })

  it('com o módulo Estimativa por horas desligado, recusa citando o nome', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(74, bia, project.id))

    const result = await handlersFor(manager, unitOfWork)('estimates.set', {
      taskId: taskIdOf(74),
      estimatedHours: 1,
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    if (result.ok) return
    expect(result.error.message).toContain('Estimativa por horas')
  })

  it('colaborador que não participa não define estimativa; recusa valores fora da faixa', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const { bia, project } = await seedTeam(unitOfWork)
    await handlersFor(manager, unitOfWork)('teamModules.change', { enable: ['estimates.hours'] })
    await unitOfWork.repositories.tasks.save(organizationId, taskOwnedBy(75, bia, project.id))

    await expect(
      handlersFor(collaborator, unitOfWork)('estimates.set', {
        taskId: taskIdOf(75),
        estimatedHours: 1,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    for (const estimatedHours of [-1, 1.234, 1000.5, Number.NaN]) {
      await expect(
        handlersFor(manager, unitOfWork)('estimates.set', { taskId: taskIdOf(75), estimatedHours }),
      ).resolves.toEqual({ ok: false, error: { code: 'VALIDATION', message: 'Entrada inválida' } })
    }
  })

  describe('custo estimado e realizado por quem olha (M3.7 pelo IPC)', () => {
    /**
     * T1: gestor responsável (6000 centavos/h), sem horas; colaborador é só membro do projeto.
     * T2: gestor responsável (6000) e colaborador de apoio (4500), com 1 h dele; estimativa 10 h.
     * Parcelas da estimativa (10 h dividida entre 2): gestor 300 R$, colaborador 225 R$.
     */
    async function seedCostScenario() {
      const unitOfWork = new InMemoryUnitOfWork()
      const { ana, bia, project } = await seedTeam(unitOfWork)
      await unitOfWork.repositories.projects.addMember(organizationId, {
        projectId: project.id,
        userId: ana.id,
        addedBy: bia.id,
        addedAt: '2026-01-01T00:00:00.000Z',
      })
      await handlersFor(manager, unitOfWork)('teamModules.change', { enable: ['estimates.hours'] })

      const outsider = aTask()
        .with({
          id: taskIdOf(81),
          organizationId,
          projectId: project.id,
          title: 'Alheia',
          responsibleRateCents: 6000,
        })
        .ownedBy(bia)
        .build()
      await unitOfWork.repositories.tasks.save(organizationId, setEstimatedHours(outsider, 1000))

      const base = aTask()
        .with({
          id: taskIdOf(82),
          organizationId,
          projectId: project.id,
          title: 'Compartilhada',
          responsibleRateCents: 6000,
        })
        .ownedBy(bia)
        .build()
      const support = aParticipation(base)
        .with({
          id: toParticipationId('00000000000000000000000008'),
          participant: { kind: 'user', userId: ana.id },
          role: 'support',
          hoursHundredths: 100,
          rateCents: 4500,
        })
        .build()
      const shared = setEstimatedHours(
        { ...base, participations: [...base.participations, support] },
        1000,
      )
      await unitOfWork.repositories.tasks.save(organizationId, shared)
      return unitOfWork
    }

    it('colaborador de fora do time da tarefa recebe custo estimado e realizado nulos', async () => {
      const unitOfWork = await seedCostScenario()

      const result = await handlersFor(collaborator, unitOfWork)('tasks.get', {
        taskId: taskIdOf(81),
      })

      expect(result).toMatchObject({
        ok: true,
        value: { estimatedHours: 10, estimatedCost: null, realizedCost: null, total: null },
      })
      if (!result.ok) return
      expect(getTaskOutputSchema.safeParse(result.value).success).toBe(true)
      const participations = (result.value as { participations: { rate: number | null }[] })
        .participations
      expect(participations.every((p) => p.rate === null)).toBe(true)
    })

    it('colaborador participante recebe só a própria parcela: estimado 225 R$ e realizado 45 R$', async () => {
      const unitOfWork = await seedCostScenario()

      const result = await handlersFor(collaborator, unitOfWork)('tasks.get', {
        taskId: taskIdOf(82),
      })

      expect(result).toMatchObject({
        ok: true,
        value: { estimatedHours: 10, estimatedCost: 225, realizedCost: 45 },
      })
      if (!result.ok) return
      expect(getTaskOutputSchema.safeParse(result.value).success).toBe(true)
    })

    it('gestor vê o custo estimado total (300 + 225 R$) e o realizado da tarefa', async () => {
      const unitOfWork = await seedCostScenario()

      await expect(
        handlersFor(manager, unitOfWork)('tasks.get', { taskId: taskIdOf(82) }),
      ).resolves.toMatchObject({
        ok: true,
        value: { estimatedCost: 525, realizedCost: 45 },
      })
    })
  })
})
