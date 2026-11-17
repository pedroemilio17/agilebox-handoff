import type { OrganizationId } from '@agilebox/core'
import type { UnitOfWork, UnitOfWorkRepositories } from '../../ports'
import {
  createInMemoryState,
  InMemoryAcceptanceRepository,
  InMemoryBoardSettingsRepository,
  InMemoryChecklistRepository,
  InMemoryContributorRepository,
  InMemoryDailyEntryRepository,
  InMemoryDefinitionOfDoneRepository,
  InMemoryGuideProgressRepository,
  InMemoryImpedimentRepository,
  InMemoryTaskCommentRepository,
  InMemoryMeetingRepository,
  InMemoryOrganizationRepository,
  InMemoryParticipationRepository,
  InMemoryProjectModulesRepository,
  InMemoryProjectSetupRepository,
  InMemoryProjectRepository,
  InMemoryRetroActionRepository,
  InMemoryTaskDependencyRepository,
  InMemoryTaskOpenRepository,
  InMemoryTaskRepository,
  InMemoryTeamToolsRepository,
  InMemoryTimelineRepository,
  InMemoryDeliverableRepository,
  InMemoryMilestoneRepository,
  InMemorySprintRepository,
  InMemorySprintTaskRepository,
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
      acceptance: new InMemoryAcceptanceRepository(state),
      boardSettings: new InMemoryBoardSettingsRepository(state),
      checklist: new InMemoryChecklistRepository(state),
      comments: new InMemoryTaskCommentRepository(state),
      contributors: new InMemoryContributorRepository(state),
      dailyEntries: new InMemoryDailyEntryRepository(state),
      definitionOfDone: new InMemoryDefinitionOfDoneRepository(state),
      deliverables: new InMemoryDeliverableRepository(state),
      milestones: new InMemoryMilestoneRepository(state),
      guideProgress: new InMemoryGuideProgressRepository(state),
      impediments: new InMemoryImpedimentRepository(state),
      meetings: new InMemoryMeetingRepository(state),
      organizations: new InMemoryOrganizationRepository(state),
      participations: new InMemoryParticipationRepository(state),
      projectModules: new InMemoryProjectModulesRepository(state),
      projectSetup: new InMemoryProjectSetupRepository(state),
      projects: new InMemoryProjectRepository(state),
      retroActions: new InMemoryRetroActionRepository(state),
      sprints: new InMemorySprintRepository(state),
      sprintTasks: new InMemorySprintTaskRepository(state),
      taskDependencies: new InMemoryTaskDependencyRepository(state),
      taskOpens: new InMemoryTaskOpenRepository(state),
      tasks: new InMemoryTaskRepository(state),
      teamTools: new InMemoryTeamToolsRepository(state),
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
      acceptance: copyMap(this.state.acceptance),
      boardSettings: new Map(this.state.boardSettings),
      checklist: copyMap(this.state.checklist),
      comments: copyMap(this.state.comments),
      contributors: copyMap(this.state.contributors),
      dailyEntries: copyMap(this.state.dailyEntries),
      definitionOfDone: copyMap(this.state.definitionOfDone),
      deliverables: copyMap(this.state.deliverables),
      milestones: copyMap(this.state.milestones),
      guideProgress: copyMap(this.state.guideProgress),
      meetings: copyMap(this.state.meetings),
      participations: copyMap(this.state.participations),
      projects: copyMap(this.state.projects),
      projectModules: copyMap(this.state.projectModules),
      projectSetup: copyMap(this.state.projectSetup),
      members: copyMap(this.state.members),
      retroActions: copyMap(this.state.retroActions),
      sprints: copyMap(this.state.sprints),
      sprintTasks: copyMap(this.state.sprintTasks),
      impediments: copyMap(this.state.impediments),
      organizations: new Map(this.state.organizations),
      taskDependencies: copyMap(this.state.taskDependencies),
      taskOpens: copyMap(this.state.taskOpens),
      tasks: copyMap(this.state.tasks),
      teamPreferences: new Map(this.state.teamPreferences),
      teamModules: copyMap(this.state.teamModules),
      teamToolsAudit: copyMap(this.state.teamToolsAudit),
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
