import { aProject, aTask, aUser } from './builders'
import {
  describeAcceptanceRepositoryContract,
  acceptanceFixtures,
} from './acceptance-repository-contract'
import { InMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import { toParticipationId, toProjectId, toTaskId, toUserId } from '@agilebox/core'

const { organizationA, organizationB } = acceptanceFixtures

describeAcceptanceRepositoryContract('fake em memória', async () => {
  const unitOfWork = new InMemoryUnitOfWork()
  const repositories = unitOfWork.repositories
  const userA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD0')
  const userB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FD1')
  const projectA = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD2')
  const projectB = toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FD3')
  await repositories.users.save(
    organizationA,
    aUser().with({ id: userA, organizationId: organizationA }).build(),
  )
  await repositories.users.save(
    organizationB,
    aUser().with({ id: userB, organizationId: organizationB, email: 'b@example.com' }).build(),
  )
  await repositories.projects.save(
    organizationA,
    aProject().with({ id: projectA, organizationId: organizationA, createdBy: userA }).build(),
  )
  await repositories.projects.save(
    organizationB,
    aProject().with({ id: projectB, organizationId: organizationB, createdBy: userB }).build(),
  )
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
  await repositories.tasks.save(organizationA, taskA)
  await repositories.tasks.save(organizationB, taskB)
  return { acceptance: repositories.acceptance, tasks: repositories.tasks, taskA, taskB }
})
