import { describe, expect, it } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import { createCompositionRoot } from './composition-root.js'

describe('composition root do processo principal', () => {
  it('seeda o banco vazio em desenvolvimento e monta os casos de uso', async () => {
    const root = await createCompositionRoot({
      databasePath: ':memory:',
      isProduction: false,
      windows: { getAll: () => [] },
    })

    const actor = root.useCases.session.getCurrentActor.execute()
    await expect(
      root.useCases.session.listUsers.execute({
        userId: toUserId(actor.userId),
        organizationId: toOrganizationId(actor.organizationId),
        role: actor.role,
      }),
    ).resolves.toHaveLength(5)
    expect(root.useCases.session.getCurrentActor.execute().role).toBe('collaborator')
    root.close()
  })
})
