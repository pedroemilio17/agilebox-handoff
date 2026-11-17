import { describe, expect, it, vi } from 'vitest'
import {
  DefinitionOfDoneNotConfirmedError,
  PermissionDeniedError,
  NotFoundError,
  toUserId,
  toOrganizationId,
} from '@agilebox/core'
import type { ActorSession, TenantContext } from '@agilebox/application'
import { createTenantContext } from '@agilebox/application'
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

  it('injeta o contexto da sessão e ignora qualquer ator ou time enviado pelo renderer', async () => {
    const execute = vi.fn((context: TenantContext, input: { name: string }) => ({
      userId: context.actor.userId,
      name: input.name,
    }))
    const handler = createIpcHandler(inputSchema, session, execute)

    const result = await handler(
      {},
      {
        name: 'Projeto',
        actor: { userId: 'atacante' },
        userId: 'atacante',
        tenantId: '00000000000000000000000009',
        organizationId: '00000000000000000000000009',
      },
    )

    expect(execute).toHaveBeenCalledWith(createTenantContext(actor), { name: 'Projeto' })
    expect(execute.mock.calls[0]?.[0].tenantId).toBe(actor.organizationId)
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

  it('leva os itens que faltaram na conclusão ao renderer', async () => {
    const missing = [{ id: '01J8Y4G2XK8Z1S6M3Q9W0A5V01', title: 'Testes passando' }]
    const handler = createIpcHandler(inputSchema, session, () => {
      throw new DefinitionOfDoneNotConfirmedError(missing)
    })

    const result = await handler({}, { name: 'Projeto' })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'DEFINITION_OF_DONE_NOT_CONFIRMED',
        message: 'Confirme a definição de pronto antes de concluir',
        missingItems: missing,
      },
    })
  })
})
