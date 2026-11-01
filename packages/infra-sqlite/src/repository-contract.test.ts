import { afterAll } from 'vitest'
import { aProject, aUser, describeRepositoryContract } from '@agilebox/application/testing'
import { toOrganizationId, toUserId } from '@agilebox/core'
import { createSqliteClient } from './client.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { organizations } from './schema/organizations.js'
import { projects } from './schema/projects.js'
import { users } from './schema/users.js'

const clientsToClose: Array<ReturnType<typeof createSqliteClient>> = []

describeRepositoryContract('repositórios SQLite', () => {
  const database = createSqliteClient(':memory:')
  clientsToClose.push(database)
  const createdAt = '2026-01-01T00:00:00.000Z'
  database
    .insert(organizations)
    .values([
      { id: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'), name: 'A', createdAt },
      { id: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'), name: 'B', createdAt },
    ])
    .run()
  const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  const defaultUser = aUser().with({ organizationId, email: 'default@example.com' }).build()
  const actorUser = aUser()
    .with({
      id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'),
      organizationId,
      email: 'actor@example.com',
    })
    .build()
  database.insert(users).values([defaultUser, actorUser]).run()
  const defaultProject = aProject().with({ organizationId }).build()
  database
    .insert(projects)
    .values({ ...defaultProject, nameKey: 'fixture-default-project' })
    .run()
  const core = createSqliteCoreRepositories(database)
  return {
    ...core,
    ...createSqliteTaskRepositories(database),
    meetings: createSqliteMeetingRepository(database),
  }
})

afterAll(() => {
  for (const database of clientsToClose) database.$client.close()
})
