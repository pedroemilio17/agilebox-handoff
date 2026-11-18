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
  TaskDependencyRepository,
  ContributorRepository,
  DefinitionOfDoneRepository,
  DeliverableRepository,
  GuideProgressRepository,
  IdGenerator,
  MeetingRepository,
  MilestoneRepository,
  RiskRepository,
  BaselineRepository,
  OrganizationRepository,
  ParticipationRepository,
  ProjectModulesRepository,
  ProjectRepository,
  ProjectSetupRepository,
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
  readonly deliverables: DeliverableRepository
  readonly guideProgress: GuideProgressRepository
  readonly idGenerator: IdGenerator
  readonly impediments: ImpedimentRepository
  readonly meetings: MeetingRepository
  readonly milestones: MilestoneRepository
  readonly organizations: OrganizationRepository
  readonly participations: ParticipationRepository
  readonly projectModules: ProjectModulesRepository
  readonly projects: ProjectRepository
  readonly projectSetup: ProjectSetupRepository
  readonly retroActions: RetroActionRepository
  readonly risks: RiskRepository
  readonly baselines: BaselineRepository
  readonly sprints: SprintRepository
  readonly sprintTasks: SprintTaskRepository
  readonly taskDependencies: TaskDependencyRepository
  readonly taskOpens: TaskOpenRepository
  readonly tasks: TaskRepository
  readonly teamTools: TeamToolsRepository
  readonly timeline: TimelineRepository
  readonly unitOfWork: UnitOfWork
  readonly users: UserRepository
}
