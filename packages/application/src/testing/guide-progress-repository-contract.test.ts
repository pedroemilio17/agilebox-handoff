import { InMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import {
  describeGuideProgressRepositoryContract,
  guideProgressSeed,
} from './guide-progress-repository-contract'

describeGuideProgressRepositoryContract('fake em memória', async () => {
  const unitOfWork = new InMemoryUnitOfWork()
  const { users, projects } = guideProgressSeed()
  for (const user of users) await unitOfWork.repositories.users.save(user.organizationId, user)
  for (const project of projects)
    await unitOfWork.repositories.projects.save(project.organizationId, project)
  return unitOfWork.repositories.guideProgress
})
