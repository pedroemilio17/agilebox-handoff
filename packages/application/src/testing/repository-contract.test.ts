import { describeRepositoryContract, describeTeamRepositoryContract } from './repository-contract'
import {
  InMemoryContributorRepository,
  InMemoryMeetingRepository,
  InMemoryParticipationRepository,
  InMemoryProjectRepository,
  InMemoryTaskCriteriaRepository,
  InMemoryTaskOpenRepository,
  InMemoryTaskRepository,
  InMemoryTeamModuleEventRepository,
  InMemoryTeamModuleRepository,
  InMemoryTeamSettingsRepository,
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
    taskCriteria: new InMemoryTaskCriteriaRepository(state),
    taskOpens: new InMemoryTaskOpenRepository(state),
    tasks: new InMemoryTaskRepository(state),
    timeline: new InMemoryTimelineRepository(state),
    users: new InMemoryUserRepository(state),
  }
})

describeTeamRepositoryContract('repositórios em memória', () => {
  const state = createInMemoryState()
  return {
    teamModuleEvents: new InMemoryTeamModuleEventRepository(state),
    teamModules: new InMemoryTeamModuleRepository(state),
    teamSettings: new InMemoryTeamSettingsRepository(state),
  }
})
