import {
  describeDeliverableRepositoryContract,
  describeMilestoneRepositoryContract,
} from '../deliverable-repository-contract'
import {
  InMemoryDeliverableRepository,
  InMemoryMilestoneRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryUserRepository,
  createInMemoryState,
} from './in-memory-repositories'

const makeAdapters = () => {
  const state = createInMemoryState()
  return {
    projects: new InMemoryProjectRepository(state),
    users: new InMemoryUserRepository(state),
    tasks: new InMemoryTaskRepository(state),
    deliverables: new InMemoryDeliverableRepository(state),
    milestones: new InMemoryMilestoneRepository(state),
  }
}

describeDeliverableRepositoryContract('repositórios em memória', makeAdapters)
describeMilestoneRepositoryContract('repositórios em memória', makeAdapters)
