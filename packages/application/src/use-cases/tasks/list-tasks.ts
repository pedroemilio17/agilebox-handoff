import {
  canViewTask,
  isVisibleOnBoard,
  staleDays,
  flowWeeks,
  flowMetrics,
  isOverdueTask,
  toDateOnly,
  NotFoundError,
  PermissionDeniedError,
  participates,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, OrganizationId, Task, TenantContext } from '@agilebox/core'
import { toTaskDto } from '../../mappers'
import type { TaskViewDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { BACKLOG_MODULE, readModuleState } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'

export interface ListBoardInput {
  readonly projectId?: string
  readonly forUserId?: string
}

/**
 * Quadro (B1 A, M3.5): com o módulo Backlog ativo ou encerrando, só aparecem as tarefas `onBoard`.
 * Desligado (ou nunca gravado), o quadro mostra tudo, como antes do backlog. Exportado para que o
 * dashboard conte exatamente o que o quadro mostra.
 */
export async function onlyBoardTasks(
  deps: AppDeps,
  organizationId: OrganizationId,
  tasks: readonly Task[],
): Promise<readonly Task[]> {
  const backlogState = await readModuleState(deps, organizationId, BACKLOG_MODULE)
  return tasks.filter((task) => isVisibleOnBoard(task, backlogState))
}

async function scopedBoard(deps: AppDeps, ctx: TenantContext, actor: Actor, input: ListBoardInput) {
  const organizationId = assertTenant(ctx, actor)
  if (input.forUserId !== undefined && actor.role !== 'manager')
    throw new PermissionDeniedError('Somente o gestor pode filtrar por usuário')
  const query = {
    ...(input.projectId === undefined ? {} : { projectId: toProjectId(input.projectId) }),
    userId: input.forUserId === undefined ? actor.userId : toUserId(input.forUserId),
  }
  return onlyBoardTasks(deps, organizationId, await deps.tasks.listBoard(organizationId, query))
}

export class GetBoardFlow {
  constructor(private readonly deps: AppDeps) {}
  async execute(ctx: TenantContext, actor: Actor, input: ListBoardInput) {
    const organizationId = assertTenant(ctx, actor)
    const tasks = await scopedBoard(this.deps, ctx, actor, input)
    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const week = flowWeeks(toDateOnly(new Date(now), timeZone), timeZone)[5]!
    const events = (
      await Promise.all(tasks.map((task) => this.deps.timeline.listByTask(organizationId, task.id)))
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

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: ListBoardInput,
  ): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const tasks = await scopedBoard(this.deps, ctx, actor, input)
    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    return Promise.all(
      tasks.map(async (task) => {
        const events =
          task.status === 'in_progress' || task.status === 'review'
            ? await this.deps.timeline.listByTask(organizationId, task.id)
            : []
        return {
          ...toTaskDto(task, actor),
          agingDays: staleDays(task, events, today, timeZone),
          overdue: isOverdueTask(task, today),
        }
      }),
    )
  }
}

export class ListTeamBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly projectId?: string },
  ): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const projectId = input.projectId === undefined ? undefined : toProjectId(input.projectId)
    const tasks = await onlyBoardTasks(
      this.deps,
      organizationId,
      await this.deps.tasks.listBoard(organizationId, projectId === undefined ? {} : { projectId }),
    )
    return tasks
      .filter((task) => actor.role === 'manager' || participates(actor, task))
      .map((task) => toTaskDto(task, actor))
  }
}

/**
 * Tarefas arquivadas da tela Ajustes (M3.0b). Mesma regra de leitura do quadro de equipe: o gestor
 * vê todas do time; os demais, só as que participam. A ordem é a da porta (mais recentes primeiro).
 */
export class ListArchivedTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const archived = await this.deps.tasks.listArchived(organizationId)
    return archived
      .filter((task) => actor.role === 'manager' || participates(actor, task))
      .map((task) => toTaskDto(task, actor))
  }
}

export class ListRecentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    return (await this.deps.tasks.listRecent(organizationId, actor.userId)).map((task) =>
      toTaskDto(task, actor),
    )
  }
}

export class ListFrequentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    return (await this.deps.tasks.listFrequent(organizationId, actor.userId)).map((task) =>
      toTaskDto(task, actor),
    )
  }
}

export class SearchTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly query: string },
  ): Promise<readonly TaskViewDto[]> {
    const organizationId = assertTenant(ctx, actor)
    return (await this.deps.tasks.search(organizationId, input.query, actor.userId)).map((task) =>
      toTaskDto(task, actor),
    )
  }
}

export class RecordTaskOpen {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<void> {
    const organizationId = assertTenant(ctx, actor)
    const taskId = toTaskId(input.taskId)
    const task = await this.deps.tasks.findById(organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const members = await this.deps.projects.listMembers(organizationId, task.projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canViewTask(actor, task, isMember))
      throw new PermissionDeniedError('Sem acesso a esta tarefa')
    const openedAt = await this.deps.clock.now(organizationId)
    await this.deps.taskOpens.recordOpen(organizationId, taskId, actor.userId, openedAt)
  }
}
