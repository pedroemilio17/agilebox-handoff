import { describeRepositoryContract } from './repository-contract'
import {
  InMemoryContributorRepository,
  InMemoryMeetingRepository,
  InMemoryParticipationRepository,
  InMemoryProjectRepository,
  InMemoryTaskOpenRepository,
  InMemoryTaskRepository,
  InMemoryTimelineRepository,
  InMemoryUserRepository,
  createInMemoryState,
} from './fakes/in-memory-repositories'

describeRepositoryContract('repositórios em memória', () => {
  const state = createInMemoryState()
  return {
    contributors: new InMemoryContributorRepository(state),
    meetings: new InMemoryMeetingRepository(state),
    participations: new InMemoryParticipationRepository(state),
    projects: new InMemoryProjectRepository(state),
    taskOpens: new InMemoryTaskOpenRepository(state),
    tasks: new InMemoryTaskRepository(state),
    timeline: new InMemoryTimelineRepository(state),
    users: new InMemoryUserRepository(state),
  }
})
