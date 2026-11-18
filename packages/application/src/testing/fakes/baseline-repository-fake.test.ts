import { describeBaselineRepositoryContract } from '../baseline-repository-contract'
import {
  InMemoryBaselineRepository,
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
    baselines: new InMemoryBaselineRepository(state),
  }
}

describeBaselineRepositoryContract('repositório em memória', makeAdapters)
