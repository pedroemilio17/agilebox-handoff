import {
  applyTeamToolsUpdate,
  auditRecordsFor,
  ConflictError,
  createOrganization,
  createTeamToolsSettings,
  defaultTeamTools,
  toOrganizationId,
  ValidationError,
} from '@agilebox/core'
import type {
  AcceptanceCriterion,
  BacklogRankChange,
  BoardSettings,
  ExperienceLevel,
  TeamModuleSetting,
  TeamToolsAuditEntry,
  TeamToolsSettings,
  TeamToolsUpdate,
  UserId,
  ChecklistItem,
  DefinitionOfDoneItem,
  DailyEntry,
  DefinitionOfDoneItemId,
  Contributor,
  TaskComment,
  Meeting,
  Organization,
  RetroAction,
  OrganizationId,
  Participation,
  Project,
  ProjectId,
  Sprint,
  SprintId,
  SprintStatus,
  SprintTask,
  Task,
  TaskId,
  TimelineEvent,
  User,
} from '@agilebox/core'
import type {
  AcceptanceRepository,
  BoardSettingsRepository,
  ChecklistRepository,
  ContributorRepository,
  DailyEntryRepository,
  DefinitionOfDoneRepository,
  TaskCommentRepository,
  MeetingRepository,
  OrganizationRepository,
  ParticipationRepository,
  ProjectMember,
  ProjectRepository,
  RetroActionRepository,
  SprintRepository,
  SprintTaskRepository,
  TaskOpenRepository,
  TaskRepository,
  TeamToolsRepository,
  TimelineRepository,
  UserRepository,
} from '../../ports'

const taskStatusOrder = ['planning', 'todo', 'in_progress', 'review', 'done'] as const

export interface InMemoryState {
  acceptance: Map<OrganizationId, Map<string, AcceptanceCriterion>>
  boardSettings: Map<OrganizationId, BoardSettings>
  checklist: Map<OrganizationId, Map<string, ChecklistItem>>
  comments: Map<OrganizationId, Map<string, TaskComment>>
  contributors: Map<OrganizationId, Map<string, Contributor>>
  dailyEntries: Map<OrganizationId, Map<string, DailyEntry>>
  definitionOfDone: Map<OrganizationId, Map<string, DefinitionOfDoneItem>>
  meetings: Map<OrganizationId, Map<string, Meeting>>
  retroActions: Map<OrganizationId, Map<string, RetroAction>>
  /** Sprints por id, com o descarte lógico (linha não some; `discarded` marca a exclusão). */
  sprints: Map<OrganizationId, Map<string, InMemorySprintRow>>
  /** Histórico de tarefas em sprints; chave: sprint, tarefa e entrada. */
  sprintTasks: Map<OrganizationId, Map<string, SprintTask>>
  participations: Map<OrganizationId, Map<string, Participation>>
  projects: Map<OrganizationId, Map<string, Project>>
  members: Map<OrganizationId, Map<string, ProjectMember>>
  organizations: Map<OrganizationId, Organization>
  taskOpens: Map<OrganizationId, Map<string, { openedAt: string; count: number }>>
  tasks: Map<OrganizationId, Map<string, Task>>
  /** Uma linha de preferência por organização (nível da equipe e autoria do nível). */
  teamPreferences: Map<OrganizationId, TeamPreferenceRow>
  /** Linhas de `team_modules`, por módulo, dentro da organização. */
  teamModules: Map<OrganizationId, Map<string, TeamModuleSetting>>
  /** Auditoria por id (texto do id numérico). */
  teamToolsAudit: Map<OrganizationId, Map<string, TeamToolsAuditEntry>>
  teamToolsAuditNextId: number
  timeline: Map<OrganizationId, Map<string, TimelineEvent>>
  users: Map<OrganizationId, Map<string, User>>
}

export function createInMemoryState(): InMemoryState {
  // Organização padrão dos testes (mesmo id dos builders), com o prefixo padrão AB.
  const defaultOrganization = createOrganization({
    id: toOrganizationId('00000000000000000000000001'),
    name: 'Organização de teste',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  return {
    acceptance: new Map(),
    boardSettings: new Map(),
    checklist: new Map(),
    comments: new Map(),
    contributors: new Map(),
    dailyEntries: new Map(),
    definitionOfDone: new Map(),
    meetings: new Map(),
    retroActions: new Map(),
    sprints: new Map(),
    sprintTasks: new Map(),
    participations: new Map(),
    projects: new Map(),
    members: new Map(),
    organizations: new Map([[defaultOrganization.id, defaultOrganization]]),
    taskOpens: new Map(),
    tasks: new Map(),
    teamPreferences: new Map(),
    teamModules: new Map(),
    teamToolsAudit: new Map(),
    teamToolsAuditNextId: 1,
    timeline: new Map(),
    users: new Map(),
  }
}

/** Linha de sprint no fake: a sprint e o descarte lógico (nulos enquanto não descartada). */
export interface InMemorySprintRow {
  readonly sprint: Sprint
  readonly discardedAt: string | null
  readonly discardedBy: string | null
}

export interface TeamPreferenceRow {
  readonly experienceLevel: ExperienceLevel
  readonly changedBy: UserId | null
  readonly changedAt: string | null
}

function bucket<T>(root: Map<OrganizationId, Map<string, T>>, organizationId: OrganizationId) {
  let values = root.get(organizationId)
  if (!values) {
    values = new Map()
    root.set(organizationId, values)
  }
  return values
}

/** Como o SQLite (conflito de id), um id já usado por outra organização não é regravado. */
function usedByOtherOrganization<T>(
  root: Map<OrganizationId, Map<string, T>>,
  organizationId: OrganizationId,
  id: string,
): boolean {
  return [...root].some(([owner, values]) => owner !== organizationId && values.has(id))
}

export class InMemoryOrganizationRepository implements OrganizationRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(id: OrganizationId) {
    await Promise.resolve()
    return this.state.organizations.get(id) ?? null
  }
  async save(value: Organization) {
    await Promise.resolve()
    this.state.organizations.set(value.id, value)
  }
}

export class InMemoryBoardSettingsRepository implements BoardSettingsRepository {
  constructor(private readonly state: InMemoryState) {}
  async findByOrganization(organizationId: OrganizationId) {
    await Promise.resolve()
    return this.state.boardSettings.get(organizationId) ?? null
  }
  async save(organizationId: OrganizationId, settings: BoardSettings) {
    await Promise.resolve()
    if (settings.organizationId === organizationId)
      this.state.boardSettings.set(organizationId, settings)
  }
}

export class InMemoryAcceptanceRepository implements AcceptanceRepository {
  constructor(private readonly state: InMemoryState) {}
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return [...bucket(this.state.acceptance, org).values()]
      .filter((criterion) => criterion.taskId === taskId)
      .sort((a, b) => a.position - b.position)
  }
  async listByTasks(org: OrganizationId, taskIds: readonly TaskId[]) {
    await Promise.resolve()
    return [...bucket(this.state.acceptance, org).values()]
      .filter((criterion) => taskIds.includes(criterion.taskId))
      .sort((a, b) => a.position - b.position)
  }
  async saveMany(org: OrganizationId, criteria: readonly AcceptanceCriterion[]) {
    await Promise.resolve()
    const tasks = bucket(this.state.tasks, org)
    const values = bucket(this.state.acceptance, org)
    for (const criterion of criteria) {
      if (tasks.has(criterion.taskId)) values.set(criterion.id, criterion)
    }
  }
  async remove(org: OrganizationId, criterionId: AcceptanceCriterion['id']) {
    await Promise.resolve()
    bucket(this.state.acceptance, org).delete(criterionId)
  }
  async countByOrganization(org: OrganizationId) {
    await Promise.resolve()
    const tasks = bucket(this.state.tasks, org)
    return [...bucket(this.state.acceptance, org).values()].filter(
      (criterion) => tasks.get(criterion.taskId)?.archivedAt === null,
    ).length
  }
}

export class InMemoryChecklistRepository implements ChecklistRepository {
  constructor(private readonly state: InMemoryState) {}
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return [...bucket(this.state.checklist, org).values()]
      .filter((item) => item.taskId === taskId)
      .sort((a, b) => a.position - b.position)
  }
  async listByTasks(org: OrganizationId, taskIds: readonly TaskId[]) {
    await Promise.resolve()
    const ids = new Set<string>(taskIds)
    return [...bucket(this.state.checklist, org).values()].filter((item) => ids.has(item.taskId))
  }
  async saveMany(org: OrganizationId, items: readonly ChecklistItem[]) {
    await Promise.resolve()
    const tasks = bucket(this.state.tasks, org)
    const values = bucket(this.state.checklist, org)
    for (const item of items) {
      if (tasks.has(item.taskId)) values.set(item.id, item)
    }
  }
  async remove(org: OrganizationId, itemId: ChecklistItem['id']) {
    await Promise.resolve()
    bucket(this.state.checklist, org).delete(itemId)
  }
}

export class InMemoryDefinitionOfDoneRepository implements DefinitionOfDoneRepository {
  constructor(private readonly state: InMemoryState) {}
  async listByProject(org: OrganizationId, projectId: ProjectId) {
    await Promise.resolve()
    return [...bucket(this.state.definitionOfDone, org).values()]
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => a.position - b.position)
  }
  async listByOrganization(org: OrganizationId) {
    await Promise.resolve()
    return [...bucket(this.state.definitionOfDone, org).values()].sort(
      (a, b) => a.projectId.localeCompare(b.projectId) || a.position - b.position,
    )
  }
  async saveMany(org: OrganizationId, items: readonly DefinitionOfDoneItem[]) {
    await Promise.resolve()
    const projects = bucket(this.state.projects, org)
    const values = bucket(this.state.definitionOfDone, org)
    for (const item of items) {
      if (item.organizationId === org && projects.has(item.projectId)) values.set(item.id, item)
    }
  }
  async remove(org: OrganizationId, itemId: DefinitionOfDoneItemId) {
    await Promise.resolve()
    bucket(this.state.definitionOfDone, org).delete(itemId)
  }
}

export class InMemoryTaskCommentRepository implements TaskCommentRepository {
  constructor(private readonly state: InMemoryState) {}
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return [...bucket(this.state.comments, org).values()]
      .filter((item) => item.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  }
  async countByTasks(org: OrganizationId, taskIds: readonly TaskId[]) {
    await Promise.resolve()
    const counts = new Map<TaskId, number>()
    for (const item of bucket(this.state.comments, org).values()) {
      if (taskIds.includes(item.taskId)) counts.set(item.taskId, (counts.get(item.taskId) ?? 0) + 1)
    }
    return [...counts].map(([taskId, count]) => ({ taskId, count }))
  }
  async findById(org: OrganizationId, commentId: TaskComment['id']) {
    await Promise.resolve()
    return bucket(this.state.comments, org).get(commentId) ?? null
  }
  async save(org: OrganizationId, comment: TaskComment) {
    await Promise.resolve()
    if (bucket(this.state.tasks, org).has(comment.taskId))
      bucket(this.state.comments, org).set(comment.id, comment)
  }
  async remove(org: OrganizationId, commentId: TaskComment['id']) {
    await Promise.resolve()
    bucket(this.state.comments, org).delete(commentId)
  }
}

export class InMemoryContributorRepository implements ContributorRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: Contributor['id']) {
    await Promise.resolve()
    return bucket(this.state.contributors, org).get(id) ?? null
  }
  async list(org: OrganizationId) {
    await Promise.resolve()
    return [...bucket(this.state.contributors, org).values()]
  }
  async save(org: OrganizationId, value: Contributor) {
    await Promise.resolve()
    if (usedByOtherOrganization(this.state.contributors, org, value.id)) return
    bucket(this.state.contributors, org).set(value.id, { ...value, organizationId: org })
  }
}

export class InMemoryMeetingRepository implements MeetingRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: Meeting['id']) {
    await Promise.resolve()
    return bucket(this.state.meetings, org).get(id) ?? null
  }
  async listOverlapping(
    org: OrganizationId,
    rangeStart: Meeting['date'],
    rangeEnd: Meeting['date'],
  ) {
    await Promise.resolve()
    return [...bucket(this.state.meetings, org).values()]
      .filter((item) =>
        item.recurrence === 'weekly'
          ? item.date <= rangeEnd &&
            (item.recurrenceUntil === null || item.recurrenceUntil >= rangeStart)
          : item.date >= rangeStart && item.date <= rangeEnd,
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }
  async save(org: OrganizationId, value: Meeting) {
    await Promise.resolve()
    bucket(this.state.meetings, org).set(value.id, value)
  }
  async remove(org: OrganizationId, id: Meeting['id']) {
    await Promise.resolve()
    bucket(this.state.meetings, org).delete(id)
    // Como a chave estrangeira com ON DELETE CASCADE do SQLite: os combinados saem junto.
    const actions = bucket(this.state.retroActions, org)
    for (const [actionId, action] of actions) {
      if (action.meetingId === id) actions.delete(actionId)
    }
  }
}

export class InMemoryDailyEntryRepository implements DailyEntryRepository {
  constructor(private readonly state: InMemoryState) {}
  async findByUserAndDate(
    org: OrganizationId,
    userId: DailyEntry['userId'],
    date: DailyEntry['date'],
  ) {
    await Promise.resolve()
    return (
      [...bucket(this.state.dailyEntries, org).values()].find(
        (item) => item.userId === userId && item.date === date,
      ) ?? null
    )
  }
  async listByDate(org: OrganizationId, date: DailyEntry['date']) {
    await Promise.resolve()
    return [...bucket(this.state.dailyEntries, org).values()].filter((item) => item.date === date)
  }
  async save(org: OrganizationId, value: DailyEntry) {
    await Promise.resolve()
    // Só grava daily de usuário desta organização.
    if (bucket(this.state.users, org).has(value.userId))
      bucket(this.state.dailyEntries, org).set(value.id, value)
  }
  async countByOrganization(org: OrganizationId) {
    await Promise.resolve()
    return bucket(this.state.dailyEntries, org).size
  }
}

export class InMemoryRetroActionRepository implements RetroActionRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: RetroAction['id']) {
    await Promise.resolve()
    return bucket(this.state.retroActions, org).get(id) ?? null
  }
  async listByOccurrence(
    org: OrganizationId,
    meetingId: Meeting['id'],
    occurrenceDate: RetroAction['occurrenceDate'],
  ) {
    await Promise.resolve()
    return [...bucket(this.state.retroActions, org).values()]
      .filter((item) => item.meetingId === meetingId && item.occurrenceDate === occurrenceDate)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  }
  async listByMeetings(org: OrganizationId, meetingIds: readonly Meeting['id'][]) {
    await Promise.resolve()
    const ids = new Set<string>(meetingIds)
    return [...bucket(this.state.retroActions, org).values()].filter((item) =>
      ids.has(item.meetingId),
    )
  }
  async save(org: OrganizationId, value: RetroAction) {
    await Promise.resolve()
    // Só grava combinado de agendamento desta organização.
    if (bucket(this.state.meetings, org).has(value.meetingId))
      bucket(this.state.retroActions, org).set(value.id, value)
  }
  async remove(org: OrganizationId, id: RetroAction['id']) {
    await Promise.resolve()
    bucket(this.state.retroActions, org).delete(id)
  }
}

export class InMemoryParticipationRepository implements ParticipationRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: Participation['id']) {
    await Promise.resolve()
    return bucket(this.state.participations, org).get(id) ?? null
  }
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return [...bucket(this.state.participations, org).values()].filter(
      (item) => item.taskId === taskId,
    )
  }
  async save(org: OrganizationId, value: Participation) {
    await Promise.resolve()
    bucket(this.state.participations, org).set(value.id, value)
  }
  async remove(org: OrganizationId, id: Participation['id']) {
    await Promise.resolve()
    bucket(this.state.participations, org).delete(id)
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: Project['id']) {
    await Promise.resolve()
    return bucket(this.state.projects, org).get(id) ?? null
  }
  async findByNameKey(org: OrganizationId, key: string) {
    await Promise.resolve()
    return (
      [...bucket(this.state.projects, org).values()].find((item) => item.nameKey === key) ?? null
    )
  }
  async list(org: OrganizationId) {
    await Promise.resolve()
    return [...bucket(this.state.projects, org).values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }
  async save(org: OrganizationId, value: Project) {
    await Promise.resolve()
    if (usedByOtherOrganization(this.state.projects, org, value.id)) return
    bucket(this.state.projects, org).set(value.id, { ...value, organizationId: org })
  }
  async listMembers(org: OrganizationId, projectId: Project['id']) {
    await Promise.resolve()
    return [...bucket(this.state.members, org).values()].filter(
      (item) => item.projectId === projectId,
    )
  }
  async addMember(org: OrganizationId, member: ProjectMember) {
    await Promise.resolve()
    bucket(this.state.members, org).set(`${member.projectId}:${member.userId}`, member)
  }
  async removeMember(org: OrganizationId, projectId: Project['id'], userId: User['id']) {
    await Promise.resolve()
    bucket(this.state.members, org).delete(`${projectId}:${userId}`)
  }
}

export class InMemoryTaskOpenRepository implements TaskOpenRepository {
  constructor(private readonly state: InMemoryState) {}
  async recordOpen(org: OrganizationId, taskId: TaskId, userId: User['id'], openedAt: string) {
    await Promise.resolve()
    const values = bucket(this.state.taskOpens, org)
    const key = `${userId}:${taskId}`
    const previous = values.get(key)
    values.set(key, { openedAt, count: (previous?.count ?? 0) + 1 })
  }
}

export class InMemoryTaskRepository implements TaskRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: TaskId) {
    await Promise.resolve()
    return bucket(this.state.tasks, org).get(id) ?? null
  }
  async nextNumber(org: OrganizationId) {
    await Promise.resolve()
    const numbers = [...bucket(this.state.tasks, org).values()].map((task) => task.number)
    return Math.max(0, ...numbers) + 1
  }
  async findByProjectNameKey(org: OrganizationId, projectId: Task['projectId'], nameKey: string) {
    await Promise.resolve()
    return (
      [...bucket(this.state.tasks, org).values()].find(
        (item) =>
          item.projectId === projectId &&
          item.title.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR') === nameKey,
      ) ?? null
    )
  }
  async listByProject(org: OrganizationId, projectId: Task['projectId']) {
    await Promise.resolve()
    return [...bucket(this.state.tasks, org).values()]
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }
  async listBoard(
    org: OrganizationId,
    query: { projectId?: Task['projectId']; userId?: User['id'] },
  ) {
    await Promise.resolve()
    return [...bucket(this.state.tasks, org).values()]
      .filter(
        (item) =>
          (query.projectId === undefined || item.projectId === query.projectId) &&
          (query.userId === undefined ||
            item.createdBy === query.userId ||
            item.participations.some(
              (part) =>
                part.participant.kind === 'user' && part.participant.userId === query.userId,
            )),
      )
      .sort(
        (a, b) =>
          taskStatusOrder.indexOf(a.status) - taskStatusOrder.indexOf(b.status) ||
          a.createdAt.localeCompare(b.createdAt),
      )
  }
  async listRecent(org: OrganizationId, userId: User['id']) {
    await Promise.resolve()
    return this.forUser(org, userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  async listFrequent(org: OrganizationId, userId: User['id']) {
    await Promise.resolve()
    const opens = bucket(this.state.taskOpens, org)
    return this.forUser(org, userId)
      .sort(
        (a, b) =>
          (opens.get(`${userId}:${b.id}`)?.openedAt ?? '').localeCompare(
            opens.get(`${userId}:${a.id}`)?.openedAt ?? '',
          ) ||
          (opens.get(`${userId}:${b.id}`)?.count ?? 0) -
            (opens.get(`${userId}:${a.id}`)?.count ?? 0),
      )
      .filter((task) => opens.has(`${userId}:${task.id}`))
  }
  async search(org: OrganizationId, query: string, userId: User['id']) {
    await Promise.resolve()
    const normalized = query
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('pt-BR')
      .trim()
    return this.forUser(org, userId).filter((item) => item.searchText.includes(normalized))
  }
  async findByNumber(org: OrganizationId, number: number, userId: User['id']) {
    await Promise.resolve()
    return this.forUser(org, userId).find((item) => item.number === number) ?? null
  }
  async listBacklog(org: OrganizationId, projectId: Task['projectId']) {
    await Promise.resolve()
    return [...bucket(this.state.tasks, org).values()].filter(
      (item) => item.projectId === projectId && item.backlogRank !== null,
    )
  }
  async updateBacklogRanks(org: OrganizationId, changes: readonly BacklogRankChange[]) {
    await Promise.resolve()
    const values = bucket(this.state.tasks, org)
    for (const change of changes) {
      const task = values.get(change.taskId)
      if (task) values.set(task.id, { ...task, backlogRank: change.backlogRank })
    }
  }
  async save(org: OrganizationId, value: Task) {
    await Promise.resolve()
    bucket(this.state.tasks, org).set(value.id, value)
  }
  private forUser(org: OrganizationId, userId: User['id']) {
    return [...bucket(this.state.tasks, org).values()].filter(
      (item) =>
        item.createdBy === userId ||
        item.participations.some(
          (part) => part.participant.kind === 'user' && part.participant.userId === userId,
        ),
    )
  }
}

export class InMemoryTimelineRepository implements TimelineRepository {
  constructor(private readonly state: InMemoryState) {}
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return [...bucket(this.state.timeline, org).values()]
      .filter((item) => item.taskId === taskId)
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
  }
  async saveMany(org: OrganizationId, events: readonly TimelineEvent[]) {
    await Promise.resolve()
    const values = bucket(this.state.timeline, org)
    for (const event of events) values.set(event.id, event)
  }
}

export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: User['id']) {
    await Promise.resolve()
    return bucket(this.state.users, org).get(id) ?? null
  }
  async list(org: OrganizationId) {
    await Promise.resolve()
    return [...bucket(this.state.users, org).values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }
  async save(org: OrganizationId, value: User) {
    await Promise.resolve()
    if (usedByOtherOrganization(this.state.users, org, value.id)) return
    bucket(this.state.users, org).set(value.id, { ...value, organizationId: org })
  }
}

export class InMemoryTeamToolsRepository implements TeamToolsRepository {
  constructor(private readonly state: InMemoryState) {}

  private read(organizationId: OrganizationId): TeamToolsSettings {
    const preference = this.state.teamPreferences.get(organizationId)
    if (!preference) return defaultTeamTools(organizationId)
    return createTeamToolsSettings({
      level: preference.experienceLevel,
      modules: [...bucket(this.state.teamModules, organizationId).values()],
    })
  }

  async getSettings(organizationId: OrganizationId) {
    await Promise.resolve()
    return this.read(organizationId)
  }

  async saveSettings(
    organizationId: OrganizationId,
    update: TeamToolsUpdate,
    actorId: UserId,
    at: string,
  ) {
    await Promise.resolve()
    if (this.state.users.get(organizationId)?.has(actorId) !== true)
      throw new ValidationError('Ator de outra organização')

    // Valida tudo antes de escrever: um conjunto inválido não deixa nada gravado.
    const { settings, changes } = applyTeamToolsUpdate(this.read(organizationId), update, {
      organizationId,
      actorId,
      at,
    })

    const modules = bucket(this.state.teamModules, organizationId)
    for (const module of settings.modules) modules.set(module.moduleId, module)

    const previous = this.state.teamPreferences.get(organizationId)
    const levelChanged = changes.some((change) => change.kind === 'level')
    this.state.teamPreferences.set(organizationId, {
      experienceLevel: settings.level,
      changedBy: levelChanged ? actorId : (previous?.changedBy ?? null),
      changedAt: levelChanged ? at : (previous?.changedAt ?? null),
    })

    const audit = bucket(this.state.teamToolsAudit, organizationId)
    for (const record of auditRecordsFor(changes, { organizationId, actorId, at })) {
      const id = this.state.teamToolsAuditNextId++
      audit.set(String(id), { ...record, id })
    }
  }

  async listAudit(organizationId: OrganizationId, limit: number) {
    await Promise.resolve()
    if (!Number.isInteger(limit) || limit < 1)
      throw new ValidationError('Limite de auditoria inválido')
    return [...bucket(this.state.teamToolsAudit, organizationId).values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .slice(0, limit)
  }
}

const sprintRowKey = (row: Pick<SprintTask, 'sprintId' | 'taskId' | 'addedAt'>) =>
  `${row.sprintId}|${row.taskId}|${row.addedAt}`

export class InMemorySprintRepository implements SprintRepository {
  constructor(private readonly state: InMemoryState) {}

  private visible(org: OrganizationId): Sprint[] {
    return [...bucket(this.state.sprints, org).values()]
      .filter((row) => row.discardedAt === null)
      .map((row) => row.sprint)
  }

  async findById(org: OrganizationId, sprintId: SprintId) {
    await Promise.resolve()
    const row = bucket(this.state.sprints, org).get(sprintId)
    return row && row.discardedAt === null ? row.sprint : null
  }
  async listByProject(org: OrganizationId, projectId: ProjectId, status?: SprintStatus) {
    await Promise.resolve()
    return this.visible(org)
      .filter((sprint) => sprint.projectId === projectId)
      .filter((sprint) => status === undefined || sprint.status === status)
      .sort((a, b) => a.number - b.number)
  }
  async nextNumber(org: OrganizationId, projectId: ProjectId) {
    await Promise.resolve()
    const numbers = [...bucket(this.state.sprints, org).values()]
      .filter((row) => row.sprint.projectId === projectId)
      .map((row) => row.sprint.number)
    return Math.max(0, ...numbers) + 1
  }
  async countActive(org: OrganizationId, projectId: ProjectId) {
    await Promise.resolve()
    return this.visible(org).filter(
      (sprint) => sprint.projectId === projectId && sprint.status === 'active',
    ).length
  }
  async countNotClosed(org: OrganizationId) {
    await Promise.resolve()
    return this.visible(org).filter((sprint) => sprint.status !== 'closed').length
  }
  async save(org: OrganizationId, sprint: Sprint) {
    await Promise.resolve()
    const values = bucket(this.state.sprints, org)
    const previous = values.get(sprint.id)
    values.set(sprint.id, {
      sprint,
      discardedAt: previous?.discardedAt ?? null,
      discardedBy: previous?.discardedBy ?? null,
    })
  }
  async markDiscarded(org: OrganizationId, sprintId: SprintId, at: string, by: UserId) {
    await Promise.resolve()
    const values = bucket(this.state.sprints, org)
    const row = values.get(sprintId)
    if (row) values.set(sprintId, { ...row, discardedAt: at, discardedBy: by })
  }
}

export class InMemorySprintTaskRepository implements SprintTaskRepository {
  constructor(private readonly state: InMemoryState) {}

  private rows(org: OrganizationId): SprintTask[] {
    return [...bucket(this.state.sprintTasks, org).values()]
  }

  async listBySprint(org: OrganizationId, sprintId: SprintId) {
    await Promise.resolve()
    return this.rows(org)
      .filter((row) => row.sprintId === sprintId)
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.taskId.localeCompare(b.taskId))
  }
  async listOpenByTasks(org: OrganizationId, taskIds: readonly TaskId[]) {
    await Promise.resolve()
    return this.rows(org).filter((row) => row.removedAt === null && taskIds.includes(row.taskId))
  }
  async listByTask(org: OrganizationId, taskId: TaskId) {
    await Promise.resolve()
    return this.rows(org)
      .filter((row) => row.taskId === taskId)
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  }
  async countOpenInNotClosed(org: OrganizationId) {
    await Promise.resolve()
    const sprints = bucket(this.state.sprints, org)
    return this.rows(org).filter(
      (row) =>
        row.removedAt === null &&
        sprints.get(row.sprintId)?.discardedAt === null &&
        sprints.get(row.sprintId)?.sprint.status !== 'closed',
    ).length
  }
  async saveRows(org: OrganizationId, requested: readonly SprintTask[]) {
    await Promise.resolve()
    const values = bucket(this.state.sprintTasks, org)
    const sprints = bucket(this.state.sprints, org)
    const tasks = bucket(this.state.tasks, org)
    // Sprint ou tarefa de outra organização não é regravada (mesma regra dos demais repositórios).
    const rows = requested.filter((row) => sprints.has(row.sprintId) && tasks.has(row.taskId))
    // Confere o estado final do lote: no máximo uma linha aberta por tarefa.
    const next = new Map(values)
    for (const row of rows) next.set(sprintRowKey(row), row)
    const openPerTask = new Map<string, number>()
    for (const row of next.values()) {
      if (row.removedAt !== null) continue
      openPerTask.set(row.taskId, (openPerTask.get(row.taskId) ?? 0) + 1)
    }
    if ([...openPerTask.values()].some((count) => count > 1))
      throw new ConflictError('Tarefa já tem uma sprint aberta')
    for (const row of rows) values.set(sprintRowKey(row), row)
  }
}
