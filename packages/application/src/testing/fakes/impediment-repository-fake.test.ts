import { describeImpedimentRepositoryContract } from '../impediment-repository-contract'
import {
  InMemoryImpedimentRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryUserRepository,
  createInMemoryState,
} from './in-memory-repositories'

describeImpedimentRepositoryContract('repositórios em memória', () => {
  const state = createInMemoryState()
  return {
    impediments: new InMemoryImpedimentRepository(state),
    projects: new InMemoryProjectRepository(state),
    tasks: new InMemoryTaskRepository(state),
    users: new InMemoryUserRepository(state),
  }
})
