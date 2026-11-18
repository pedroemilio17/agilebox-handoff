import { InMemoryUnitOfWork } from './fakes/in-memory-unit-of-work'
import { describeProjectSetupRepositoryContract } from './project-setup-repository-contract'
import { projectModulesSeed } from './project-modules-repository-contract'

describeProjectSetupRepositoryContract('fake em memória', async () => {
  const unitOfWork = new InMemoryUnitOfWork()
  const { users, projects } = projectModulesSeed()
  for (const user of users) await unitOfWork.repositories.users.save(user.organizationId, user)
  for (const project of projects)
    await unitOfWork.repositories.projects.save(project.organizationId, project)
  return unitOfWork.repositories.projectSetup
})
