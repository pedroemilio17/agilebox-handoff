import { MODULE_IDS } from '@agilebox/core'
import type {
  Contributor,
  Meeting,
  ModuleId,
  OrganizationId,
  Participation,
  Project,
  Task,
  TaskId,
  TimelineEvent,
  User,
} from '@agilebox/core'
import type {
  ContributorRepository,
  MeetingRepository,
  ParticipationRepository,
  ProjectMember,
  ProjectRepository,
  TaskOpenRepository,
  TaskRepository,
  TeamModule,
  TeamModuleEvent,
  TeamModuleEventRepository,
  TeamModuleRepository,
  TeamSettings,
  TeamSettingsRepository,
  TimelineRepository,
  UserRepository,
} from '../../ports'

const moduleOrder = (moduleId: ModuleId) => MODULE_IDS.indexOf(moduleId)

const taskStatusOrder = ['planning', 'todo', 'in_progress', 'review', 'done'] as const

export interface InMemoryState {
  contributors: Map<OrganizationId, Map<string, Contributor>>
  meetings: Map<OrganizationId, Map<string, Meeting>>
  participations: Map<OrganizationId, Map<string, Participation>>
  projects: Map<OrganizationId, Map<string, Project>>
  members: Map<OrganizationId, Map<string, ProjectMember>>
  taskOpens: Map<OrganizationId, Map<string, { openedAt: string; count: number }>>
  tasks: Map<OrganizationId, Map<string, Task>>
  teamModuleEvents: Map<OrganizationId, TeamModuleEvent[]>
  teamModules: Map<OrganizationId, Map<string, TeamModule>>
  teamSettings: Map<OrganizationId, TeamSettings>
  timeline: Map<OrganizationId, Map<string, TimelineEvent>>
  users: Map<OrganizationId, Map<string, User>>
}

export function createInMemoryState(): InMemoryState {
  return {
    contributors: new Map(),
    meetings: new Map(),
    participations: new Map(),
    projects: new Map(),
    members: new Map(),
    taskOpens: new Map(),
    tasks: new Map(),
    teamModuleEvents: new Map(),
    teamModules: new Map(),
    teamSettings: new Map(),
    timeline: new Map(),
    users: new Map(),
  }
}

function bucket<T>(root: Map<OrganizationId, Map<string, T>>, organizationId: OrganizationId) {
  let values = root.get(organizationId)
  if (!values) {
    values = new Map()
    root.set(organizationId, values)
  }
  return values
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
    bucket(this.state.contributors, org).set(value.id, value)
  }
}

export class InMemoryMeetingRepository implements MeetingRepository {
  constructor(private readonly state: InMemoryState) {}
  async findById(org: OrganizationId, id: Meeting['id']) {
    await Promise.resolve()
    return bucket(this.state.meetings, org).get(id) ?? null
  }
  async listByMonth(org: OrganizationId, month: string) {
    await Promise.resolve()
    return [...bucket(this.state.meetings, org).values()]
      .filter((item) => item.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }
  async listUpcoming(org: OrganizationId, today: Meeting['date']) {
    await Promise.resolve()
    return [...bucket(this.state.meetings, org).values()]
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }
  async save(org: OrganizationId, value: Meeting) {
    await Promise.resolve()
    bucket(this.state.meetings, org).set(value.id, value)
  }
  async remove(org: OrganizationId, id: Meeting['id']) {
    await Promise.resolve()
    bucket(this.state.meetings, org).delete(id)
  }
  async count(org: OrganizationId) {
    await Promise.resolve()
    return bucket(this.state.meetings, org).size
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
  async count(org: OrganizationId) {
    await Promise.resolve()
    // Mesmas linhas que o SQLite conta: participações gravadas e a de responsável de cada tarefa.
    const ids = new Set(bucket(this.state.participations, org).keys())
    for (const task of bucket(this.state.tasks, org).values()) {
      for (const participation of task.participations) ids.add(participation.id)
    }
    return ids.size
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
    bucket(this.state.projects, org).set(value.id, value)
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
  async save(org: OrganizationId, value: Task) {
    await Promise.resolve()
    bucket(this.state.tasks, org).set(value.id, value)
  }
  async count(org: OrganizationId) {
    await Promise.resolve()
    return bucket(this.state.tasks, org).size
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

export class InMemoryTeamModuleRepository implements TeamModuleRepository {
  constructor(private readonly state: InMemoryState) {}
  async list(org: OrganizationId) {
    await Promise.resolve()
    return [...bucket(this.state.teamModules, org).values()].sort(
      (a, b) => moduleOrder(a.moduleId) - moduleOrder(b.moduleId),
    )
  }
  async save(org: OrganizationId, value: TeamModule) {
    await Promise.resolve()
    bucket(this.state.teamModules, org).set(value.moduleId, value)
  }
}

export class InMemoryTeamModuleEventRepository implements TeamModuleEventRepository {
  constructor(private readonly state: InMemoryState) {}
  async append(org: OrganizationId, event: TeamModuleEvent) {
    await Promise.resolve()
    const events = this.state.teamModuleEvents.get(org) ?? []
    this.state.teamModuleEvents.set(org, [...events, event])
  }
  async list(org: OrganizationId) {
    await Promise.resolve()
    return [...(this.state.teamModuleEvents.get(org) ?? [])].sort(
      (a, b) => a.changedAt.localeCompare(b.changedAt) || a.id.localeCompare(b.id),
    )
  }
}

export class InMemoryTeamSettingsRepository implements TeamSettingsRepository {
  constructor(private readonly state: InMemoryState) {}
  async find(org: OrganizationId) {
    await Promise.resolve()
    return this.state.teamSettings.get(org) ?? null
  }
  async save(org: OrganizationId, value: TeamSettings) {
    await Promise.resolve()
    this.state.teamSettings.set(org, value)
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
    bucket(this.state.users, org).set(value.id, value)
  }
}
