import {
  canViewTask,
  staleDays,
  flowWeeks,
  flowMetrics,
  isOverdueTask,
  toDateOnly,
  NotFoundError,
  PermissionDeniedError,
  participates,
  parseTaskKey,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from './task-prefix'
import { loadChecklists } from './checklist-loader'

export interface ListBoardInput {
  readonly projectId?: string
  readonly forUserId?: string
}

async function scopedBoard(deps: AppDeps, actor: Actor, input: ListBoardInput) {
  if (input.forUserId !== undefined && actor.role !== 'manager')
    throw new PermissionDeniedError('Somente o gestor pode filtrar por usuário')
  const query = {
    ...(input.projectId === undefined ? {} : { projectId: toProjectId(input.projectId) }),
    ...(input.forUserId !== undefined
      ? { userId: toUserId(input.forUserId) }
      : actor.role === 'manager'
        ? {}
        : { userId: actor.userId }),
  }
  return deps.tasks.listBoard(actor.organizationId, query)
}

export class GetBoardFlow {
  constructor(private readonly deps: AppDeps) {}
  async execute(actor: Actor, input: ListBoardInput) {
    const tasks = await scopedBoard(this.deps, actor, input)
    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const week = flowWeeks(toDateOnly(new Date(now), timeZone), timeZone)[5]!
    const events = (
      await Promise.all(
        tasks.map((task) => this.deps.timeline.listByTask(actor.organizationId, task.id)),
      )
    ).flat()
    return {
      cycleDays: flowMetrics(tasks, events, week, now).cycleDays,
      weekStart: week.start,
      updatedAt: now,
    }
  }
}

export class ListBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListBoardInput): Promise<readonly TaskDto[]> {
    const tasks = await scopedBoard(this.deps, actor, input)
    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const checklists = await loadChecklists(
      this.deps,
      actor.organizationId,
      tasks.map((task) => task.id),
    )
    return Promise.all(
      tasks.map(async (task) => {
        const events =
          task.status === 'in_progress' || task.status === 'review'
            ? await this.deps.timeline.listByTask(actor.organizationId, task.id)
            : []
        return {
          ...toTaskDto(task, prefix, checklists.get(task.id) ?? []),
          agingDays: staleDays(task, events, today, timeZone),
          overdue: isOverdueTask(task, today),
        }
      }),
    )
  }
}

export class ListTeamBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId?: string }): Promise<readonly TaskDto[]> {
    const projectId = input.projectId === undefined ? undefined : toProjectId(input.projectId)
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const [tasks, projects] = await Promise.all([
      this.deps.tasks.listBoard(actor.organizationId, projectId === undefined ? {} : { projectId }),
      this.deps.projects.list(actor.organizationId),
    ])
    const eligibleProjectIds = new Set(
      await Promise.all(
        projects
          .filter((project) => projectId === undefined || project.id === projectId)
          .filter(
            (project) =>
              actor.role === 'manager' || project.organizationId === actor.organizationId,
          )
          .map(async (project) => {
            if (actor.role === 'manager') return project.id
            const members = await this.deps.projects.listMembers(actor.organizationId, project.id)
            return members.some((member) => member.userId === actor.userId) ? project.id : null
          }),
      ),
    )
    const visible = tasks.filter(
      (task) => eligibleProjectIds.has(task.projectId) && !participates(actor, task),
    )
    const checklists = await loadChecklists(
      this.deps,
      actor.organizationId,
      visible.map((task) => task.id),
    )
    return visible.map((task) => toTaskDto(task, prefix, checklists.get(task.id) ?? []))
  }
}

async function toTaskDtos(
  deps: AppDeps,
  actor: Actor,
  tasks: readonly Task[],
  prefix: string,
): Promise<readonly TaskDto[]> {
  const checklists = await loadChecklists(
    deps,
    actor.organizationId,
    tasks.map((task) => task.id),
  )
  return tasks.map((task) => toTaskDto(task, prefix, checklists.get(task.id) ?? []))
}

export class ListRecentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const tasks = await this.deps.tasks.listRecent(actor.organizationId, actor.userId)
    return toTaskDtos(this.deps, actor, tasks, prefix)
  }
}

export class ListFrequentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const tasks = await this.deps.tasks.listFrequent(actor.organizationId, actor.userId)
    return toTaskDtos(this.deps, actor, tasks, prefix)
  }
}

/** Número da tarefa quando a busca é o ID ("AB-118", com o prefixo da organização) ou só o número ("118"). */
function taskNumberFromQuery(query: string, prefix: string): number | null {
  const value = query.trim().toUpperCase()
  if (/^\d+$/u.test(value)) {
    const number = Number(value)
    return number > 0 ? number : null
  }
  const key = parseTaskKey(value)
  return key && key.prefix === prefix ? key.number : null
}

export class SearchTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly query: string }): Promise<readonly TaskDto[]> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const number = taskNumberFromQuery(input.query, prefix)
    const byNumber =
      number === null
        ? null
        : await this.deps.tasks.findByNumber(actor.organizationId, number, actor.userId)
    const byText = await this.deps.tasks.search(actor.organizationId, input.query, actor.userId)
    const found = byNumber
      ? [byNumber, ...byText.filter((task) => task.id !== byNumber.id)]
      : byText
    return toTaskDtos(this.deps, actor, found, prefix)
  }
}

export class RecordTaskOpen {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly taskId: string }): Promise<void> {
    const taskId = toTaskId(input.taskId)
    const task = await this.deps.tasks.findById(actor.organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const members = await this.deps.projects.listMembers(actor.organizationId, task.projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canViewTask(actor, task, isMember))
      throw new PermissionDeniedError('Sem acesso a esta tarefa')
    const openedAt = await this.deps.clock.now(actor.organizationId)
    await this.deps.taskOpens.recordOpen(actor.organizationId, taskId, actor.userId, openedAt)
  }
}
