import { describeTaskDependencyRepositoryContract } from '../task-dependency-repository-contract'
import {
  InMemoryProjectRepository,
  InMemoryTaskDependencyRepository,
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
    taskDependencies: new InMemoryTaskDependencyRepository(state),
  }
}

describeTaskDependencyRepositoryContract('repositórios em memória', makeAdapters)
