import { describeSprintRepositoryContract } from '../sprint-repository-contract'
import {
  InMemoryProjectRepository,
  InMemorySprintRepository,
  InMemorySprintTaskRepository,
  InMemoryTaskRepository,
  InMemoryUserRepository,
  createInMemoryState,
} from './in-memory-repositories'

describeSprintRepositoryContract('repositórios em memória', () => {
  const state = createInMemoryState()
  return {
    projects: new InMemoryProjectRepository(state),
    sprints: new InMemorySprintRepository(state),
    sprintTasks: new InMemorySprintTaskRepository(state),
    tasks: new InMemoryTaskRepository(state),
    users: new InMemoryUserRepository(state),
  }
})
