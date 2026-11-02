import { describe, expect, it, vi } from 'vitest'
import {
  API_CHANNELS,
  EXPERIENCE_LEVEL_IDS,
  SIDEBAR_SCREEN_IDS as CONTRACT_SCREEN_IDS,
  TEAM_MODULE_IDS,
} from '@agilebox/contract'
import type { ApiResult } from '@agilebox/contract'
import {
  EXPERIENCE_LEVELS,
  MODULE_IDS,
  SIDEBAR_SCREEN_IDS as CORE_SCREEN_IDS,
  toOrganizationId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createUseCases } from '@agilebox/application'
import type { ActorSession } from '@agilebox/application'
import {
  FixedClock,
  InMemoryUnitOfWork,
  RecordingNotifier,
  SequentialIdGenerator,
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
