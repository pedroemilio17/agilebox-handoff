import type { OrganizationId } from '@agilebox/core'
import type { ContributorRepository } from './contributor-repository'
import type { MeetingRepository } from './meeting-repository'
import type { ParticipationRepository } from './participation-repository'
import type { ProjectRepository } from './project-repository'
import type { TaskCriteriaRepository } from './task-criteria-repository'
import type { TaskOpenRepository } from './task-open-repository'
import type { TaskRepository } from './task-repository'
import type { TeamModuleEventRepository } from './team-module-event-repository'
import type { TeamModuleRepository } from './team-module-repository'
import type { TeamSettingsRepository } from './team-settings-repository'
import type { TimelineRepository } from './timeline-repository'
import type { UserRepository } from './user-repository'

export interface UnitOfWorkRepositories {
  readonly contributors: ContributorRepository
  readonly meetings: MeetingRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly taskCriteria: TaskCriteriaRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly teamModuleEvents: TeamModuleEventRepository
  readonly teamModules: TeamModuleRepository
  readonly teamSettings: TeamSettingsRepository
  readonly timeline: TimelineRepository
  readonly users: UserRepository
}

export interface UnitOfWork {
  run<T>(
    organizationId: OrganizationId,
    operation: (repositories: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T>
}
