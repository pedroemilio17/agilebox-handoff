import { afterEach, describe, expect, it } from 'vitest'
import {
  describeGuideProgressRepositoryContract,
  guideProgressFixtures,
  guideProgressSeed,
} from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations, projects, users } from '../schema/index.js'
import { createSqliteGuideProgressRepository } from './guide-progress-repository.js'

const { organizationA, organizationB } = guideProgressFixtures
const openDatabases: ReturnType<typeof createSqliteClient>[] = []
const createdAt = '2026-01-01T00:00:00.000Z'

function setup() {
  const database = createSqliteClient(':memory:')
  openDatabases.push(database)
  const { users: seededUsers, projects: seededProjects } = guideProgressSeed()
  database
    .insert(organizations)
    .values([
      { id: organizationA, name: 'A', createdAt },
      { id: organizationB, name: 'B', createdAt },
    ])
    .run()
  database.insert(users).values(seededUsers).run()
  database.insert(projects).values(seededProjects).run()
  return { database, repository: createSqliteGuideProgressRepository(database) }
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.$client.close()
})

describeGuideProgressRepositoryContract('SQLite', () => Promise.resolve(setup().repository))

describe('progresso do guia no SQLite', () => {
  it('a dispensa e os passos da mesma pessoa convivem na tabela (chave composta)', async () => {
    const { database, repository } = setup()
    const { managerA, projectA } = guideProgressFixtures
    await repository.dismissCard(organizationA, projectA, managerA, createdAt)
    await repository.markDone(organizationA, projectA, managerA, ['agil.backlog'], createdAt)

    const rows = database.$client
      .prepare('SELECT step_key, done_at, dismissed FROM guide_progress ORDER BY step_key')
      .all()
    expect(rows).toEqual([
      { step_key: '__card__', done_at: null, dismissed: 1 },
      { step_key: 'agil.backlog', done_at: createdAt, dismissed: 0 },
    ])
  })
})
