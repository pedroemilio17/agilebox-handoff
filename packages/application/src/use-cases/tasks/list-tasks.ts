import {
  canViewTask,
  NotFoundError,
  PermissionDeniedError,
  participates,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export interface ListBoardInput {
  readonly projectId?: string
  readonly forUserId?: string
}

export class ListBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListBoardInput): Promise<readonly TaskDto[]> {
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
    const tasks = await this.deps.tasks.listBoard(actor.organizationId, query)
    return tasks.map(toTaskDto)
  }
}

export class ListTeamBoard {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId?: string }): Promise<readonly TaskDto[]> {
    const projectId = input.projectId === undefined ? undefined : toProjectId(input.projectId)
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
    return tasks
      .filter((task) => eligibleProjectIds.has(task.projectId) && !participates(actor, task))
      .map(toTaskDto)
  }
}

export class ListRecentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    return (await this.deps.tasks.listRecent(actor.organizationId, actor.userId)).map(toTaskDto)
  }
}

export class ListFrequentTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly TaskDto[]> {
    return (await this.deps.tasks.listFrequent(actor.organizationId, actor.userId)).map(toTaskDto)
  }
}

export class SearchTasks {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly query: string }): Promise<readonly TaskDto[]> {
    return (await this.deps.tasks.search(actor.organizationId, input.query, actor.userId)).map(
      toTaskDto,
    )
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
