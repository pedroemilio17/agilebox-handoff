import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { createSqliteAdapters } from './create-sqlite-adapters.js'

describe('createSqliteAdapters', () => {
  it('monta todas as portas usando o mesmo banco', async () => {
    const adapters = createSqliteAdapters(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')

    try {
      await expect(
        adapters.unitOfWork.run(organizationId, (repositories) =>
          repositories.users.list(organizationId),
        ),
      ).resolves.toEqual([])
      expect(adapters.meetings).toBeDefined()
      expect(adapters.tasks).toBeDefined()
      expect(adapters.timeline).toBeDefined()
    } finally {
      adapters.close()
    }
  })
})
