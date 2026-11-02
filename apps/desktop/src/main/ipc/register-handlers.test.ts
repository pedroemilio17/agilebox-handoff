import { describe, expect, it, vi } from 'vitest'
import { API_CHANNELS, TEAM_MODULE_IDS } from '@agilebox/contract'
import type { ApiResult } from '@agilebox/contract'
import { MODULE_IDS, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createUseCases } from '@agilebox/application'
import type { ActorSession } from '@agilebox/application'
import {
  FixedClock,
  InMemoryUnitOfWork,
  RecordingNotifier,
  SequentialIdGenerator,
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
function handlersFor(actor: Actor) {
  const unitOfWork = new InMemoryUnitOfWork()
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
