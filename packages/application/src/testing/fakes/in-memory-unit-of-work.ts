import type { OrganizationId } from '@agilebox/core'
import type { UnitOfWork, UnitOfWorkRepositories } from '../../ports'
import {
  createInMemoryState,
  InMemoryContributorRepository,
  InMemoryMeetingRepository,
  InMemoryParticipationRepository,
  InMemoryProjectRepository,
  InMemoryTaskOpenRepository,
  InMemoryTaskRepository,
  InMemoryTeamModuleEventRepository,
  InMemoryTeamModuleRepository,
  InMemoryTeamSettingsRepository,
  InMemoryTimelineRepository,
  InMemoryUserRepository,
} from './in-memory-repositories'
import type { InMemoryState } from './in-memory-repositories'

function copyMap<T>(source: Map<OrganizationId, Map<string, T>>) {
  return new Map([...source].map(([organizationId, values]) => [organizationId, new Map(values)]))
}

export class InMemoryUnitOfWork implements UnitOfWork {
  readonly state: InMemoryState
  readonly repositories: UnitOfWorkRepositories
  private active = false

  constructor(state = createInMemoryState()) {
    this.state = state
    this.repositories = {
      contributors: new InMemoryContributorRepository(state),
      meetings: new InMemoryMeetingRepository(state),
      participations: new InMemoryParticipationRepository(state),
      projects: new InMemoryProjectRepository(state),
      taskOpens: new InMemoryTaskOpenRepository(state),
      tasks: new InMemoryTaskRepository(state),
      teamModuleEvents: new InMemoryTeamModuleEventRepository(state),
      teamModules: new InMemoryTeamModuleRepository(state),
      teamSettings: new InMemoryTeamSettingsRepository(state),
      timeline: new InMemoryTimelineRepository(state),
      users: new InMemoryUserRepository(state),
    }
  }

  async run<T>(
    _organizationId: OrganizationId,
    operation: (repositories: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    if (this.active) throw new Error('Transações aninhadas não são suportadas pelo fake')
    this.active = true
    const snapshot = {
      contributors: copyMap(this.state.contributors),
      meetings: copyMap(this.state.meetings),
      participations: copyMap(this.state.participations),
      projects: copyMap(this.state.projects),
      members: copyMap(this.state.members),
      taskOpens: copyMap(this.state.taskOpens),
      tasks: copyMap(this.state.tasks),
      teamModuleEvents: new Map(
        [...this.state.teamModuleEvents].map(([organizationId, events]) => [
          organizationId,
          [...events],
        ]),
      ),
      teamModules: copyMap(this.state.teamModules),
      teamSettings: new Map(this.state.teamSettings),
      timeline: copyMap(this.state.timeline),
      users: copyMap(this.state.users),
    }
    try {
      return await operation(this.repositories)
    } catch (error) {
      Object.assign(this.state, snapshot)
      throw error
    } finally {
      this.active = false
    }
  }
}
