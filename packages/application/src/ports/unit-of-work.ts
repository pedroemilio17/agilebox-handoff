import type { OrganizationId } from '@agilebox/core'
import type { AcceptanceRepository } from './acceptance-repository'
import type { BoardSettingsRepository } from './board-settings-repository'
import type { ChecklistRepository } from './checklist-repository'
import type { TaskCommentRepository } from './task-comment-repository'
import type { ContributorRepository } from './contributor-repository'
import type { DailyEntryRepository } from './daily-entry-repository'
import type { ImpedimentRepository } from './impediment-repository'
import type { DefinitionOfDoneRepository } from './definition-of-done-repository'
import type { DeliverableRepository, MilestoneRepository } from './deliverable-repository'
import type { GuideProgressRepository } from './guide-progress-repository'
import type { MeetingRepository } from './meeting-repository'
import type { OrganizationRepository } from './organization-repository'
import type { ParticipationRepository } from './participation-repository'
import type { ProjectModulesRepository } from './project-modules-repository'
import type { ProjectRepository } from './project-repository'
import type { ProjectSetupRepository } from './project-setup-repository'
import type { RetroActionRepository } from './retro-action-repository'
import type { SprintRepository, SprintTaskRepository } from './sprint-repository'
import type { TaskOpenRepository } from './task-open-repository'
import type { TaskRepository } from './task-repository'
import type { TeamToolsRepository } from './team-tools-repository'
import type { TimelineRepository } from './timeline-repository'
import type { UserRepository } from './user-repository'

export interface UnitOfWorkRepositories {
  readonly acceptance: AcceptanceRepository
  readonly boardSettings: BoardSettingsRepository
  readonly checklist: ChecklistRepository
  readonly comments: TaskCommentRepository
  readonly contributors: ContributorRepository
  readonly dailyEntries: DailyEntryRepository
  readonly definitionOfDone: DefinitionOfDoneRepository
  readonly deliverables: DeliverableRepository
  readonly guideProgress: GuideProgressRepository
  readonly impediments: ImpedimentRepository
  readonly meetings: MeetingRepository
  readonly milestones: MilestoneRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projectModules: ProjectModulesRepository
  readonly projects: ProjectRepository
  readonly projectSetup: ProjectSetupRepository
  readonly retroActions: RetroActionRepository
  readonly sprints: SprintRepository
  readonly sprintTasks: SprintTaskRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly teamTools: TeamToolsRepository
  readonly timeline: TimelineRepository
  readonly users: UserRepository
}

export interface UnitOfWork {
  run<T>(
    organizationId: OrganizationId,
    operation: (repositories: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T>
}
