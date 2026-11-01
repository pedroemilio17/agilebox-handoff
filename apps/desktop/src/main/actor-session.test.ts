import { describe, expect, it } from 'vitest'
import { createSqliteAdapters, seedDemo } from '@agilebox/infra-sqlite'
import { createActorSession } from './actor-session.js'

describe('sessão do ator', () => {
  it('usa Pedro por padrão e persiste a troca em local_settings', async () => {
    const adapters = createSqliteAdapters(':memory:')
    await seedDemo({
      ...adapters,
      changeNotifier: { publish: () => Promise.resolve() },
      now: () => '2026-11-01T12:00:00.000Z',
    })

    const session = await createActorSession(adapters.users, {
      ...adapters.settings,
      getFirstOrganizationId: () => adapters.getFirstOrganizationId(),
    })
    expect(
      (await adapters.users.findById(session.get().organizationId, session.get().userId))?.name,
    ).toBe('Pedro')
    const manager = (await adapters.users.list(session.get().organizationId)).find(
      (user) => user.role === 'manager',
    )!
    session.set({
      userId: manager.id,
      organizationId: manager.organizationId,
      role: manager.role,
    })

    const restoredSession = await createActorSession(adapters.users, {
      ...adapters.settings,
      getFirstOrganizationId: () => adapters.getFirstOrganizationId(),
    })

    expect(restoredSession.get()).toEqual(session.get())
    expect(adapters.settings.get('actor-user-id')).toBe(manager.id)
    adapters.close()
  })
})
