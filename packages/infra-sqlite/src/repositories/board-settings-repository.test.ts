import { describe, expect, it } from 'vitest'
import { aUser } from '@agilebox/application/testing'
import { createBoardSettings, toBoardSettingsId, toOrganizationId, toUserId } from '@agilebox/core'
import type { BoardSettings } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/index.js'
import { createSqliteBoardSettingsRepository } from './board-settings-repository.js'
import { createSqliteCoreRepositories } from './core-repositories.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const settingsId = toBoardSettingsId('01ARZ3NDEKTSV4RRFFQ69G5FB0')

function setup() {
  const database = createSqliteClient(':memory:')
  database
    .insert(organizations)
    .values([
      { id: orgA, name: 'A', createdAt },
      { id: orgB, name: 'B', createdAt },
    ])
    .run()
  const userA = aUser().with({ organizationId: orgA }).build()
  const userB = aUser()
    .with({ id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2'), organizationId: orgB })
    .build()
  const core = createSqliteCoreRepositories(database)
  return {
    database,
    userA,
    userB,
    ready: Promise.all([core.users.save(orgA, userA), core.users.save(orgB, userB)]),
    repository: createSqliteBoardSettingsRepository(database),
  }
}

function settingsFor(
  organizationId: BoardSettings['organizationId'],
  updatedBy: BoardSettings['updatedBy'],
  wipLimits: BoardSettings['wipLimits'],
  updatedAt = createdAt,
): BoardSettings {
  return createBoardSettings({
    id: settingsId,
    organizationId,
    wipLimits,
    updatedAt,
    updatedBy,
  })
}

describe('repositório de limites de WIP', () => {
  it('sem registro devolve null', async () => {
    const { repository, ready } = setup()
    await ready
    await expect(repository.findByOrganization(orgA)).resolves.toBeNull()
  })

  it('grava e lê os limites em JSON, mantendo as chaves ausentes ausentes', async () => {
    const { repository, userA, ready } = setup()
    await ready
    await repository.save(orgA, settingsFor(orgA, userA.id, { in_progress: 3 }))

    const found = await repository.findByOrganization(orgA)
    expect(found).toMatchObject({
      id: settingsId,
      organizationId: orgA,
      wipLimits: { in_progress: 3 },
      updatedBy: userA.id,
    })
    expect(found?.wipLimits).not.toHaveProperty('review')
  })

  it('regrava a mesma linha da organização, sem criar outra', async () => {
    const { repository, database, userA, ready } = setup()
    await ready
    await repository.save(orgA, settingsFor(orgA, userA.id, { in_progress: 3, review: 2 }))
    await repository.save(
      orgA,
      settingsFor(orgA, userA.id, { review: 5 }, '2026-02-01T00:00:00.000Z'),
    )

    await expect(repository.findByOrganization(orgA)).resolves.toMatchObject({
      wipLimits: { review: 5 },
      updatedAt: '2026-02-01T00:00:00.000Z',
    })
    const { total } = database.$client
      .prepare('SELECT COUNT(*) AS total FROM board_settings')
      .get() as { total: number }
    expect(total).toBe(1)
  })

  it('isola organizações: a configuração de A não aparece em B', async () => {
    const { repository, userA, ready } = setup()
    await ready
    await repository.save(orgA, settingsFor(orgA, userA.id, { review: 2 }))

    await expect(repository.findByOrganization(orgB)).resolves.toBeNull()
  })

  it('ignora gravação com configuração de outra organização', async () => {
    const { repository, userA, ready } = setup()
    await ready
    await repository.save(orgB, settingsFor(orgA, userA.id, { review: 2 }))

    await expect(repository.findByOrganization(orgA)).resolves.toBeNull()
    await expect(repository.findByOrganization(orgB)).resolves.toBeNull()
  })

  it('ignora gravação cujo autor não pertence à organização', async () => {
    const { repository, userB, ready } = setup()
    await ready
    await repository.save(orgA, settingsFor(orgA, userB.id, { review: 2 }))

    await expect(repository.findByOrganization(orgA)).resolves.toBeNull()
  })

  it('o banco garante uma linha por organização', async () => {
    const { database, userA, ready } = setup()
    await ready
    database.$client
      .prepare(
        'INSERT INTO board_settings (id, organization_id, wip_limits, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)',
      )
      .run(settingsId, orgA, '{}', createdAt, userA.id)

    expect(() =>
      database.$client
        .prepare(
          'INSERT INTO board_settings (id, organization_id, wip_limits, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)',
        )
        .run('01ARZ3NDEKTSV4RRFFQ69G5FB1', orgA, '{}', createdAt, userA.id),
    ).toThrow(/UNIQUE/)
  })
})
