import { describe, expect, it, vi } from 'vitest'
import { PermissionDeniedError, NotFoundError, toUserId, toOrganizationId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ActorSession } from '@agilebox/application'
import { API_SCHEMA_REGISTRY } from '@agilebox/contract'
import { createIpcHandler } from './handle'

const actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId: toOrganizationId('00000000000000000000000001'),
  role: 'collaborator' as const,
}
const session: ActorSession = { get: () => actor, set: vi.fn() }
const inputSchema = API_SCHEMA_REGISTRY['projects.create'].input

describe('handler IPC', () => {
  it('rejeita entrada inválida antes de chamar o caso de uso', async () => {
    const execute = vi.fn()
    const handler = createIpcHandler(inputSchema, session, execute)

    const result = await handler({}, { name: 42 })

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    expect(execute).not.toHaveBeenCalled()
  })

  it('injeta o ator da sessão e ignora qualquer ator enviado pelo renderer', async () => {
    const execute = vi.fn((currentActor: Actor, input: { name: string }) => ({
      userId: currentActor.userId,
      name: input.name,
    }))
    const handler = createIpcHandler(inputSchema, session, execute)

    const result = await handler({}, { name: 'Projeto', actor: { userId: 'atacante' } })

    expect(execute).toHaveBeenCalledWith(actor, { name: 'Projeto' })
    expect(result).toEqual({ ok: true, value: { userId: actor.userId, name: 'Projeto' } })
  })

  it('converte erros de permissão e de recurso ausente em Result', async () => {
    const forbidden = createIpcHandler(inputSchema, session, () => {
      throw new PermissionDeniedError('Sem acesso')
    })
    const missing = createIpcHandler(inputSchema, session, () => {
      throw new NotFoundError('Não encontrado')
    })

    await expect(forbidden({}, { name: 'x' })).resolves.toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem acesso' },
    })
    await expect(missing({}, { name: 'x' })).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Não encontrado' },
    })
  })

  it('não deixa escapar detalhes de exceções inesperadas', async () => {
    const handler = createIpcHandler(inputSchema, session, () => {
      throw new Error('segredo interno')
    })

    await expect(handler({}, { name: 'x' })).resolves.toEqual({
      ok: false,
      error: { code: 'CONFLICT', message: 'Ocorreu um erro inesperado' },
    })
  })
})
