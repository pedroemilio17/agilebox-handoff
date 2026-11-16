import { afterAll } from 'vitest'
import {
  acceptanceFixtures,
  aProject,
  aTask,
  aUser,
  describeAcceptanceRepositoryContract,
} from '@agilebox/application/testing'
import { toParticipationId, toProjectId, toTaskId, toUserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { organizations, projects, users } from '../schema/index.js'
import { createSqliteAcceptanceRepository } from './acceptance-repository.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

const { organizationA, organizationB } = acceptanceFixtures
const createdAt = '2026-01-01T00:00:00.000Z'
const openDatabases: ReturnType<typeof createSqliteClient>[] = []

describeAcceptanceRepositoryContract('repositório SQLite', async () => {
  const database = createSqliteClient(':memory:')
  openDatabases.push(database)
  database
    .insert(organizations)
    .values([
      { id: organizationA, name: 'A', createdAt },
      { id: organizationB, name: 'B', createdAt },
    ])
    .run()
  const userA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD0')
  const userB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD1')
  const projectA = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD2')
  const projectB = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD3')
  database
    .insert(users)
    .values([
      aUser().with({ id: userA, organizationId: organizationA }).build(),
      aUser().with({ id: userB, organizationId: organizationB, email: 'b@example.com' }).build(),
    ])
    .run()
  database
    .insert(projects)
    .values([
      {
        ...aProject()
          .with({ id: projectA, organizationId: organizationA, createdBy: userA })
          .build(),
        nameKey: 'p-a',
      },
      {
        ...aProject()
          .with({ id: projectB, organizationId: organizationB, createdBy: userB })
          .build(),
        nameKey: 'p-b',
      },
    ])
    .run()
  const tasks = createSqliteTaskRepositories(database).tasks
  const taskA = aTask()
    .with({
      id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FD4'),
      organizationId: organizationA,
      projectId: projectA,
      createdBy: userA,
      number: 1,
      responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FD5'),
    })
    .build()
  const taskB = aTask()
    .with({
      id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FD6'),
      organizationId: organizationB,
      projectId: projectB,
      createdBy: userB,
      number: 1,
      responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FD7'),
    })
    .build()
  await tasks.save(organizationA, taskA)
  await tasks.save(organizationB, taskB)
  return {
    acceptance: createSqliteAcceptanceRepository(database),
    tasks,
    taskA,
    taskB,
  }
})

afterAll(() => {
  for (const database of openDatabases) database.$client.close()
})
