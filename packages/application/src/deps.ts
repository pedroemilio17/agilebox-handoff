import type {
  ActorSession,
  BoardSettingsRepository,
  ChangeNotifier,
  ChecklistRepository,
  Clock,
  DailyEntryRepository,
  TaskCommentRepository,
  ContributorRepository,
  DefinitionOfDoneRepository,
  IdGenerator,
  MeetingRepository,
  OrganizationRepository,
  ParticipationRepository,
  ProjectRepository,
  RetroActionRepository,
  TaskOpenRepository,
  TaskRepository,
  TimelineRepository,
  UnitOfWork,
  UserRepository,
} from './ports'

export interface AppDeps {
  readonly actorSession: ActorSession
  readonly boardSettings: BoardSettingsRepository
  readonly changeNotifier: ChangeNotifier
  readonly checklist: ChecklistRepository
  readonly clock: Clock
  readonly comments: TaskCommentRepository
  readonly contributors: ContributorRepository
  readonly dailyEntries: DailyEntryRepository
  readonly definitionOfDone: DefinitionOfDoneRepository
  readonly idGenerator: IdGenerator
  readonly meetings: MeetingRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly retroActions: RetroActionRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly timeline: TimelineRepository
  readonly unitOfWork: UnitOfWork
  readonly users: UserRepository
}
