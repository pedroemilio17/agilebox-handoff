import {
  canPullFromBacklog,
  canReorderBacklog,
  canSendToBacklog,
  canViewBacklog,
  ConflictError,
  createTimelineEvent,
  isInBacklog,
  isManagerEdit,
  NotFoundError,
  PermissionDeniedError,
  pullFromBacklog,
  rankAtEnd,
  reorderInBacklog,
  sendToBacklog,
  sortBacklog,
  toEventId,
  toProjectId,
  toTaskId,
} from '@agilebox/core'
import type { Actor, BacklogPlacement, Task, TaskStatus } from '@agilebox/core'
import type { CreateTaskInput, TaskDto } from '@agilebox/contract'
import { toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { ChangeTask, CreateTask } from '../tasks/tasks'
import { findTaskPrefix } from '../tasks/task-prefix'
import { loadChecklists } from '../tasks/checklist-loader'
import { loadCriteria } from '../tasks/criteria-loader'
import { loadSprintRefs } from '../sprints/sprint-refs'
import { loadCommentCounts } from '../tasks/comment-loader'
import { archivedProjectIds, filterVisibleTasks } from '../tasks/task-visibility'
import { toTaskDtos } from '../tasks/list-tasks'
import { assertBacklogAccess } from './backlog-access'
import { loadImpedimentRefs } from '../impediments/impediment-refs'
import { recordGuideEvent } from '../guide/record-guide-event'

export interface ListBacklogInput {
  readonly projectId: string
  /** Inclui arquivadas e as de projeto arquivado. Padrão: ocultas. */
  readonly includeArchived?: boolean | undefined
}

/** Backlog de um projeto, na ordem do backlog. Visível a membros e ao gestor (planejar é coletivo). */
export class ListBacklog {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListBacklogInput): Promise<readonly TaskDto[]> {
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(actor.organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(actor.organizationId, projectId)
    if (
      !canViewBacklog(
        actor,
        project,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem acesso ao backlog deste projeto')
    const items = filterVisibleTasks(
      sortBacklog(await this.deps.tasks.listBacklog(actor.organizationId, projectId)),
      archivedProjectIds([project]),
      { includeArchived: input.includeArchived === true, includeBacklog: true },
    )
    return toTaskDtos(
      this.deps,
      actor,
      items,
      await findTaskPrefix(this.deps, actor.organizationId),
    )
  }
}

/** Cria o item já no backlog: mesma criação de `tasks.create`, em Planejamento e fora do quadro. */
export type AddToBacklogInput = Omit<CreateTaskInput, 'status' | 'confirmedDefinitionItemIds'>

export class AddToBacklog {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: AddToBacklogInput): Promise<TaskDto> {
    return new CreateTask(this.deps).execute(actor, input, { backlog: true })
  }
}

export interface ReorderBacklogInput {
  readonly taskId: string
  readonly position?: 'top' | 'end' | undefined
  /** A tarefa vai logo depois deste item. */
  readonly afterId?: string | null | undefined
  /** A tarefa vai logo antes deste item. */
  readonly beforeId?: string | null | undefined
}

function toPlacement(input: ReorderBacklogInput): BacklogPlacement {
  if (input.position === 'top') return { to: 'top' }
  if (input.position === 'end') return { to: 'end' }
  return {
    to: 'between',
    afterId: input.afterId ? toTaskId(input.afterId) : null,
    beforeId: input.beforeId ? toTaskId(input.beforeId) : null,
  }
}

/**
 * Reordena um item do backlog. Persiste a nova posição (e renumera se faltou espaço) e registra
 * um evento na linha do tempo quando a posição muda. Membro do projeto ou gestor.
 */
export class ReorderBacklogItem {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ReorderBacklogInput): Promise<TaskDto> {
    const task = await this.findTask(actor, input.taskId)
    await assertBacklogAccess(this.deps, actor, task, canReorderBacklog)
    if (!isInBacklog(task)) throw new ConflictError('Tarefa não está no backlog')
    const placement = toPlacement(input)
    const now = await this.deps.clock.now(actor.organizationId)
    const changed = await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const backlog = await repositories.tasks.listBacklog(actor.organizationId, task.projectId)
      const move = reorderInBacklog(backlog, task.id, placement)
      if (move.changes.length === 0) return false
      await repositories.tasks.updateBacklogRanks(actor.organizationId, move.changes)
      await repositories.timeline.saveMany(actor.organizationId, [
        createTimelineEvent({
          id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId: task.id,
          at: now,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
          type: 'task_reordered',
          payload: { position: move.position },
        }),
      ])
      await recordGuideEvent(repositories, actor, task.projectId, 'backlog.reordered', now)
      return true
    })
    if (changed)
      await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    return this.toDto(actor, task.id)
  }

  private async findTask(actor: Actor, rawTaskId: string): Promise<Task> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    return task
  }

  private async toDto(actor: Actor, taskId: Task['id']): Promise<TaskDto> {
    const task = await this.deps.tasks.findById(actor.organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const checklists = await loadChecklists(this.deps, actor.organizationId, [task.id])
    const criteria = await loadCriteria(this.deps, actor.organizationId, [task.id])
    const counts = await loadCommentCounts(this.deps, actor, [task])
    const sprint = (await loadSprintRefs(this.deps, actor.organizationId, [task.id])).get(task.id)
    const impedimentRef =
      (await loadImpedimentRefs(this.deps, actor.organizationId, [task.id])).get(task.id) ?? null
    return toTaskDto(
      task,
      await findTaskPrefix(this.deps, actor.organizationId),
      checklists.get(task.id) ?? [],
      counts.get(task.id) ?? 0,
      criteria.get(task.id) ?? [],
      sprint ?? null,
      impedimentRef,
    )
  }
}

export interface PullFromBacklogInput {
  readonly taskId: string
  /** Coluna do quadro. Padrão: A fazer. Planejamento não é coluna de saída. */
  readonly status?: Exclude<TaskStatus, 'planning'> | undefined
  readonly confirmedDefinitionItemIds?: readonly string[] | undefined
}

/** Puxa o item para o quadro. A linha do tempo registra a saída do backlog e a mudança de coluna. */
export class PullFromBacklog extends ChangeTask {
  async execute(actor: Actor, input: PullFromBacklogInput): Promise<TaskDto> {
    const status: TaskStatus = input.status ?? 'todo'
    return this.change(
      actor,
      input.taskId,
      (task) => pullFromBacklog(task, status),
      [{ type: 'task_pulled_from_backlog', payload: { status } }],
      input.confirmedDefinitionItemIds ?? [],
      'backlog',
      canPullFromBacklog,
    )
  }
}

/**
 * Devolve ao backlog uma tarefa que ainda não começou. Vai para o fim do backlog e o estado
 * vira Planejamento. Em andamento, revisão ou concluída, recusa com conflito.
 */
export class SendToBacklog extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }): Promise<TaskDto> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(input.taskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    await assertBacklogAccess(this.deps, actor, task, canSendToBacklog)
    const rank = rankAtEnd(await this.deps.tasks.listBacklog(actor.organizationId, task.projectId))
    return this.change(
      actor,
      input.taskId,
      (current) => sendToBacklog(current, rank),
      [{ type: 'task_sent_to_backlog', payload: {} }],
      [],
      'backlog',
      canSendToBacklog,
    )
  }
}
