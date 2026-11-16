import { createUser } from '@agilebox/core'
import type { OrganizationId, UserId } from '@agilebox/core'
import { InMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import {
  describeTeamToolsRepositoryContract,
  teamToolsFixtures,
} from './team-tools-repository-contract'

describeTeamToolsRepositoryContract('fake em memória', async () => {
  const unitOfWork = new InMemoryUnitOfWork()
  const { organizationA, organizationB, managerA, managerB } = teamToolsFixtures
  await unitOfWork.repositories.users.save(organizationA, manager(managerA, organizationA))
  await unitOfWork.repositories.users.save(organizationB, manager(managerB, organizationB))
  return unitOfWork.repositories.teamTools
})

function manager(id: UserId, organizationId: OrganizationId) {
  return createUser({
    id,
    organizationId,
    name: 'Gestora',
    email: `${id}@example.com`,
    role: 'manager',
    defaultRateCents: 4500,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
}
