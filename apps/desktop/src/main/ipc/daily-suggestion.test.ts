import { describe, expect, it, vi } from 'vitest'
import { API_SCHEMA_REGISTRY } from '@agilebox/contract'
import { toOrganizationId, toUserId } from '@agilebox/core'
import type { ActorSession, TenantContext } from '@agilebox/application'
import { createIpcHandler } from './handle'

const actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId: toOrganizationId('00000000000000000000000001'),
  role: 'collaborator' as const,
}
const session: ActorSession = { get: () => actor, set: vi.fn() }

describe('canal IPC daily.suggestSummary', () => {
  it('payload forjado: userId e organização do pedido são ignorados, o ator vem da sessão', async () => {
    const execute = vi.fn((_context: TenantContext, input: unknown) => ({ input }))
    const handler = createIpcHandler(
      API_SCHEMA_REGISTRY['daily.suggestSummary'].input,
      session,
      execute,
    )

    const result = await handler(
      {},
      {
        date: '2026-11-04',
        timeZone: 'America/Sao_Paulo',
        userId: '00000000000000000000000099',
        organizationId: '00000000000000000000000098',
      },
    )

    expect(result).toMatchObject({ ok: true })
    expect(execute).toHaveBeenCalledTimes(1)
    const [context, input] = execute.mock.calls[0]!
    expect(input).toEqual({ date: '2026-11-04', timeZone: 'America/Sao_Paulo' })
    expect(context.actor).toEqual(actor)
  })

  it('entrada sem fuso é recusada antes do caso de uso', async () => {
    const execute = vi.fn()
    const handler = createIpcHandler(
      API_SCHEMA_REGISTRY['daily.suggestSummary'].input,
      session,
      execute,
    )
    const result = await handler({}, { date: '2026-11-04' })
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    expect(execute).not.toHaveBeenCalled()
  })
})
