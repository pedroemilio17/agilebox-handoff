import { describe, expect, it, vi } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import type { ActorSession, TenantContext } from '@agilebox/application'
import { API_SCHEMA_REGISTRY } from '@agilebox/contract'
import { createIpcHandler } from './handle'

const actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId: toOrganizationId('00000000000000000000000001'),
  role: 'manager' as const,
}
const session: ActorSession = { get: () => actor, set: vi.fn() }

describe('canais IPC das ferramentas da equipe', () => {
  it('ignora userId e tenantId enviados pelo renderer: o contexto vem só da sessão', async () => {
    const execute = vi.fn((context: TenantContext, input: unknown) => ({ context, input }))
    const handler = createIpcHandler(
      API_SCHEMA_REGISTRY['teamTools.applyChange'].input,
      session,
      execute,
    )

    const result = await handler(
      {},
      {
        disable: ['wip'],
        userId: '00000000000000000000000099',
        tenantId: '00000000000000000000000098',
      },
    )

    expect(result.ok).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
    const [context, input] = execute.mock.calls[0]!
    expect(context.actor).toEqual(actor)
    expect(context.tenantId).toBe(actor.organizationId)
    expect(input).toEqual({ disable: ['wip'] })
  })

  it('recusa entrada fora do contrato antes de chamar o caso de uso', async () => {
    const execute = vi.fn()
    const handler = createIpcHandler(
      API_SCHEMA_REGISTRY['teamTools.applyPreset'].input,
      session,
      execute,
    )

    const result = await handler({}, { presetId: 'inventado' })

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    expect(execute).not.toHaveBeenCalled()
  })
})
