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
  wipColumns,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'
import type { ListBoardDto, TaskDto } from '@agilebox/contract'
import { toTaskDto, toWipLimitsDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from './task-prefix'
import { loadChecklists } from './checklist-loader'
import { loadCommentCounts } from './comment-loader'
import { archivedProjectIds, filterVisibleTasks, visibleTasks } from './task-visibility'

export interface ListBoardInput {
  readonly projectId?: string
  readonly forUserId?: string
  /** Inclui arquivadas e as de projeto arquivado. Padrão: ocultas. */
  readonly includeArchived?: boolean
}

/**
 * Quadro de "Minhas tarefas": só as tarefas em que a pessoa participa (criou, é Responsável ou Apoio).
 * Vale para colaborador e gestor (PLANO 6.1). O gestor vê o quadro de outra pessoa só com `forUserId`
 * ("Abrir projetos"), e somente ele pode pedir isso.
 */
async function scopedBoard(deps: AppDeps, actor: Actor, input: ListBoardInput) {
  if (input.forUserId !== undefined && actor.role !== 'manager')
    throw new PermissionDeniedError('Somente o gestor pode filtrar por usuário')
  const query = {
    ...(input.projectId === undefined ? {} : { projectId: toProjectId(input.projectId) }),
    userId: toUserId(input.forUserId ?? actor.userId),
  }
  return visibleTasks(
    deps,
    actor.organizationId,
    await deps.tasks.listBoard(actor.organizationId, query),
    input.includeArchived,
  )
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

  /**
   * Quadro do usuário. As tarefas e a contagem de WIP vêm do mesmo conjunto: as de que a pessoa
   * participa, inclusive para o gestor no próprio quadro.
   */
  async execute(actor: Actor, input: ListBoardInput): Promise<ListBoardDto> {
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
    const counts = await loadCommentCounts(this.deps, actor, tasks)
    const settings = await this.deps.boardSettings.findByOrganization(actor.organizationId)
    const wipLimits = settings?.wipLimits ?? {}
    const boardTasks = await Promise.all(
      tasks.map(async (task) => {
        const events =
          task.status === 'in_progress' || task.status === 'review'
            ? await this.deps.timeline.listByTask(actor.organizationId, task.id)
            : []
        return {
          ...toTaskDto(task, prefix, checklists.get(task.id) ?? [], counts.get(task.id) ?? 0),
          agingDays: staleDays(task, events, today, timeZone),
          overdue: isOverdueTask(task, today),
        }
      }),
    )
    return {
      tasks: boardTasks,
      wipLimits: toWipLimitsDto(wipLimits),
      wipColumns: wipColumns(tasks, wipLimits),
    }
  }
}

export class ListTeamBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: { readonly projectId?: string; readonly includeArchived?: boolean },
  ): Promise<readonly TaskDto[]> {
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
    // Colaborador: as demais tarefas dos seus projetos (as próprias ficam em "Minhas tarefas").
    // Gestor: todas da organização, inclusive as em que participa (PLANO 6.1).
    const visible = filterVisibleTasks(
      tasks.filter(
        (task) =>
          eligibleProjectIds.has(task.projectId) &&
          (actor.role === 'manager' || !participates(actor, task)),
      ),
      archivedProjectIds(projects),
      input.includeArchived,
    )
    const checklists = await loadChecklists(
      this.deps,
      actor.organizationId,
      visible.map((task) => task.id),
    )
    const counts = await loadCommentCounts(this.deps, actor, visible)
    // Sinais de parada e de prazo calculados como no quadro, para os filtros da visão Equipe.
    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    return Promise.all(
      visible.map(async (task) => {
        const events =
          task.status === 'in_progress' || task.status === 'review'
            ? await this.deps.timeline.listByTask(actor.organizationId, task.id)
            : []
        return {
          ...toTaskDto(task, prefix, checklists.get(task.id) ?? [], counts.get(task.id) ?? 0),
          agingDays: staleDays(task, events, today, timeZone),
          overdue: isOverdueTask(task, today),
        }
      }),
    )
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
  const counts = await loadCommentCounts(deps, actor, tasks)
  return tasks.map((task) =>
    toTaskDto(task, prefix, checklists.get(task.id) ?? [], counts.get(task.id) ?? 0),
  )
}

export class ListRecentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const tasks = await visibleTasks(
      this.deps,
      actor.organizationId,
      await this.deps.tasks.listRecent(actor.organizationId, actor.userId),
    )
    return toTaskDtos(this.deps, actor, tasks, prefix)
  }
}

export class ListFrequentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const tasks = await visibleTasks(
      this.deps,
      actor.organizationId,
      await this.deps.tasks.listFrequent(actor.organizationId, actor.userId),
    )
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
    const visible = await visibleTasks(this.deps, actor.organizationId, found)
    return toTaskDtos(this.deps, actor, visible, prefix)
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
