import { describe, expect, it } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import { aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { users } from '../schema/users.js'
import { SUGGESTED_LEVEL } from '@agilebox/core'
import { teamSettings } from '../schema/index.js'
import { createSqliteTeamRepositories } from './team-repositories.js'

describe('repositórios SQLite de time', () => {
  it('lê nível desconhecido gravado no banco como o nível sugerido, sem quebrar a leitura', async () => {
    const database = createSqliteClient(':memory:')
    const createdAt = '2026-01-01T00:00:00.000Z'
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    database.insert(organizations).values({ id: organizationId, name: 'A', createdAt }).run()
    database.insert(users).values(user).run()
    database
      .insert(teamSettings)
      .values({ organizationId, level: 'expert', changedBy: user.id, changedAt: createdAt })
      .run()
    const repositories = createSqliteTeamRepositories(database)

    await expect(repositories.teamSettings.find(organizationId)).resolves.toEqual({
      level: SUGGESTED_LEVEL,
      changedBy: user.id,
      changedAt: createdAt,
    })
    database.$client.close()
  })

  it('impede dois módulos iguais no mesmo time, mas aceita o mesmo módulo em outro time', () => {
    const database = createSqliteClient(':memory:')
    const createdAt = '2026-01-01T00:00:00.000Z'
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const otherOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
    const user = aUser().with({ organizationId }).build()
    database
      .insert(organizations)
      .values([
        { id: organizationId, name: 'A', createdAt },
        { id: otherOrganizationId, name: 'B', createdAt },
      ])
      .run()
    database.insert(users).values(user).run()
    const insert = database.$client.prepare(
      'INSERT INTO team_modules (organization_id, module_id, state, config, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
    )

    insert.run(organizationId, 'agenda', 'active', '{}', user.id, createdAt)
    expect(() =>
      insert.run(organizationId, 'agenda', 'disabled', '{}', user.id, createdAt),
    ).toThrow(/UNIQUE|PRIMARY KEY/)
    expect(() =>
      insert.run(otherOrganizationId, 'agenda', 'active', '{}', user.id, createdAt),
    ).not.toThrow()

    database.$client.close()
  })

  it('substitui o estado do módulo sem duplicar a linha e relê a configuração como objeto', async () => {
    const database = createSqliteClient(':memory:')
    const createdAt = '2026-01-01T00:00:00.000Z'
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser()
      .with({ organizationId, id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX') })
      .build()
    database.insert(organizations).values({ id: organizationId, name: 'A', createdAt }).run()
    database.insert(users).values(user).run()
    const repositories = createSqliteTeamRepositories(database)

    await repositories.teamModules.save(organizationId, {
      moduleId: 'sprints',
      state: 'active',
      config: { maxActive: 2 },
      changedBy: user.id,
      changedAt: createdAt,
    })
    await repositories.teamModules.save(organizationId, {
      moduleId: 'sprints',
      state: 'disabled',
      config: { maxActive: null },
      changedBy: user.id,
      changedAt: '2026-01-02T00:00:00.000Z',
    })

    await expect(repositories.teamModules.list(organizationId)).resolves.toEqual([
      {
        moduleId: 'sprints',
        state: 'disabled',
        config: { maxActive: null },
        changedBy: user.id,
        changedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
    database.$client.close()
  })
})
