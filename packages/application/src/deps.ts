import type {
  AcceptanceRepository,
  ActorSession,
  BoardSettingsRepository,
  ChangeNotifier,
  ChecklistRepository,
  Clock,
  DailyEntryRepository,
  ImpedimentRepository,
  TaskCommentRepository,
  ContributorRepository,
  DefinitionOfDoneRepository,
  IdGenerator,
  MeetingRepository,
  OrganizationRepository,
  ParticipationRepository,
  ProjectRepository,
  RetroActionRepository,
  SprintRepository,
  SprintTaskRepository,
  TaskOpenRepository,
  TaskRepository,
  TeamToolsRepository,
  TimelineRepository,
  UnitOfWork,
  UserRepository,
} from './ports'

export interface AppDeps {
  readonly acceptance: AcceptanceRepository
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
  readonly impediments: ImpedimentRepository
  readonly meetings: MeetingRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projects: ProjectRepository
  readonly retroActions: RetroActionRepository
  readonly sprints: SprintRepository
  readonly sprintTasks: SprintTaskRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly teamTools: TeamToolsRepository
  readonly timeline: TimelineRepository
  readonly unitOfWork: UnitOfWork
  readonly users: UserRepository
}
