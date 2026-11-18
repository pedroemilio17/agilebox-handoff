import { afterAll } from 'vitest'
import { describeBaselineRepositoryContract } from '@agilebox/application/testing'
import { toOrganizationId } from '@agilebox/core'
import { createSqliteClient } from './client.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteBaselineRepository } from './repositories/baseline-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { organizations } from './schema/index.js'

const clientsToClose: Array<ReturnType<typeof createSqliteClient>> = []

function makeAdapters() {
  const database = createSqliteClient(':memory:')
  clientsToClose.push(database)
  const createdAt = '2026-01-01T00:00:00.000Z'
  database
    .insert(organizations)
    .values([
      { id: toOrganizationId('00000000000000000000000001'), name: 'A', createdAt },
      { id: toOrganizationId('00000000000000000000000002'), name: 'B', createdAt },
    ])
    .run()
  const core = createSqliteCoreRepositories(database)
  return {
    projects: core.projects,
    users: core.users,
    ...createSqliteTaskRepositories(database),
    baselines: createSqliteBaselineRepository(database),
  }
}

describeBaselineRepositoryContract('repositórios SQLite', makeAdapters)

afterAll(() => {
  for (const database of clientsToClose) database.$client.close()
})
