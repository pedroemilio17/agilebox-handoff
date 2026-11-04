import type { OrganizationId } from '@agilebox/core'
import type { ChecklistRepository } from './checklist-repository'
import type { ContributorRepository } from './contributor-repository'
import type { MeetingRepository } from './meeting-repository'
import type { OrganizationRepository } from './organization-repository'
import type { ParticipationRepository } from './participation-repository'
import type { ProjectRepository } from './project-repository'
import type { TaskOpenRepository } from './task-open-repository'
import type { TaskRepository } from './task-repository'
import type { TimelineRepository } from './timeline-repository'
import type { UserRepository } from './user-repository'

export interface UnitOfWorkRepositories {
  readonly checklist: ChecklistRepository
  readonly contributors: ContributorRepository
  readonly meetings: MeetingRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly timeline: TimelineRepository
  readonly users: UserRepository
}

export interface UnitOfWork {
  run<T>(
    organizationId: OrganizationId,
    operation: (repositories: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T>
}
