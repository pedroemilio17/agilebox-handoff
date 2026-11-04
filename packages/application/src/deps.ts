import type {
  ActorSession,
  ChangeNotifier,
  ChecklistRepository,
  Clock,
  ContributorRepository,
  IdGenerator,
  MeetingRepository,
  OrganizationRepository,
  ParticipationRepository,
  ProjectRepository,
  TaskOpenRepository,
  TaskRepository,
  TimelineRepository,
  UnitOfWork,
  UserRepository,
} from './ports'

export interface AppDeps {
  readonly actorSession: ActorSession
  readonly changeNotifier: ChangeNotifier
  readonly checklist: ChecklistRepository
  readonly clock: Clock
  readonly contributors: ContributorRepository
  readonly idGenerator: IdGenerator
  readonly meetings: MeetingRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly timeline: TimelineRepository
  readonly unitOfWork: UnitOfWork
  readonly users: UserRepository
}
