import {
  canComment,
  canEditComment,
  canRemoveComment,
  canSeeComments,
  commentAddedDraft,
  commentRemovedDraft,
  createTaskComment,
  createTimelineEvent,
  extractMentions,
  isManagerEdit,
  NotFoundError,
  PermissionDeniedError,
  toEventId,
  toTaskCommentId,
  toTaskId,
  validateCommentBody,
} from '@agilebox/core'
import type {
  Actor,
  MentionCandidate,
  OrganizationId,
  Task,
  TaskComment,
  TimelineEventDraft,
} from '@agilebox/core'
import type { TaskCommentDto } from '@agilebox/contract'
import { toTaskCommentDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { loadUserNames } from './comment-loader'

export interface AddTaskCommentInput {
  readonly taskId: string
  readonly body: string
}
export interface EditTaskCommentInput {
  readonly taskId: string
  readonly commentId: string
  readonly body: string
}
export interface RemoveTaskCommentInput {
  readonly taskId: string
  readonly commentId: string
}

/** Participantes-usuários da tarefa: só eles podem ser mencionados (entidades não entram). */
async function mentionCandidates(
  deps: AppDeps,
  organizationId: OrganizationId,
  task: Task,
): Promise<MentionCandidate[]> {
  const ids = [
    ...new Set(
      task.participations.flatMap((item) =>
        item.participant.kind === 'user' ? [item.participant.userId] : [],
      ),
    ),
  ]
  const users = await Promise.all(ids.map((id) => deps.users.findById(organizationId, id)))
  return users.flatMap((user) =>
    user ? [{ id: user.id, name: user.name, initials: user.initials }] : [],
  )
}

/** Lista os comentários da tarefa para quem pode vê-los (participante ou gestor); os demais recebem lista vazia. */
export async function loadCommentDtos(
  deps: AppDeps,
  actor: Actor,
  task: Task,
): Promise<readonly TaskCommentDto[]> {
  if (!canSeeComments(actor, task)) return []
  const [comments, names] = await Promise.all([
    deps.comments.listByTask(actor.organizationId, task.id),
    loadUserNames(deps, actor.organizationId),
  ])
  return comments.map((comment) => toTaskCommentDto(comment, task, actor, names))
}

abstract class CommentUseCase {
  constructor(protected readonly deps: AppDeps) {}

  protected async loadTask(actor: Actor, rawTaskId: string): Promise<Task> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    return task
  }

  protected async loadComment(
    actor: Actor,
    task: Task,
    rawCommentId: string,
  ): Promise<TaskComment> {
    const comment = await this.deps.comments.findById(
      actor.organizationId,
      toTaskCommentId(rawCommentId),
    )
    if (!comment || comment.taskId !== task.id) throw new NotFoundError('Comentário não encontrado')
    return comment
  }

  /** Eventos da linha do tempo, sempre com o ator e a marca de gestor. */
  protected async timelineEvents(
    actor: Actor,
    taskId: Task['id'],
    at: string,
    drafts: readonly TimelineEventDraft[],
  ) {
    return Promise.all(
      drafts.map(async (draft) =>
        createTimelineEvent({
          ...draft,
          id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId,
          at,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
        }),
      ),
    )
  }

  protected async toDto(actor: Actor, task: Task, comment: TaskComment): Promise<TaskCommentDto> {
    return toTaskCommentDto(
      comment,
      task,
      actor,
      await loadUserNames(this.deps, actor.organizationId),
    )
  }

  protected async publish(actor: Actor, task: Task): Promise<void> {
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
  }
}

/** Comentar exige poder editar a tarefa (participante ou gestor). Tarefa concluída aceita comentário. */
export class AddTaskComment extends CommentUseCase {
  async execute(actor: Actor, input: AddTaskCommentInput): Promise<TaskCommentDto> {
    const task = await this.loadTask(actor, input.taskId)
    if (!canComment(actor, task))
      throw new PermissionDeniedError('Sem permissão para comentar nesta tarefa')
    const body = validateCommentBody(input.body)
    const now = await this.deps.clock.now(actor.organizationId)
    const comment = createTaskComment({
      id: toTaskCommentId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      taskId: task.id,
      authorId: actor.userId,
      body,
      mentions: extractMentions(
        body,
        await mentionCandidates(this.deps, actor.organizationId, task),
      ),
      createdAt: now,
      editedAt: null,
      asManager: isManagerEdit(actor),
    })
    const updated: Task = { ...task, updatedAt: now }
    const events = await this.timelineEvents(actor, task.id, now, [commentAddedDraft(comment)])
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.comments.save(actor.organizationId, comment)
      await repositories.tasks.save(actor.organizationId, updated)
      await repositories.timeline.saveMany(actor.organizationId, events)
    })
    await this.publish(actor, task)
    return this.toDto(actor, updated, comment)
  }
}

/** Só o autor edita o próprio comentário. Edição não gera evento na linha do tempo; marca `editedAt`. */
export class EditTaskComment extends CommentUseCase {
  async execute(actor: Actor, input: EditTaskCommentInput): Promise<TaskCommentDto> {
    const task = await this.loadTask(actor, input.taskId)
    const comment = await this.loadComment(actor, task, input.commentId)
    if (!canEditComment(actor, task, comment))
      throw new PermissionDeniedError('Só o autor pode editar este comentário')
    const body = validateCommentBody(input.body)
    if (body === comment.body) return this.toDto(actor, task, comment)
    const now = await this.deps.clock.now(actor.organizationId)
    const next = createTaskComment({
      ...comment,
      body,
      mentions: extractMentions(
        body,
        await mentionCandidates(this.deps, actor.organizationId, task),
      ),
      editedAt: now,
    })
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.comments.save(actor.organizationId, next)
    })
    await this.publish(actor, task)
    return this.toDto(actor, task, next)
  }
}

/** O autor remove o próprio comentário; o gestor remove qualquer um (evento marcado como Gestor). */
export class RemoveTaskComment extends CommentUseCase {
  async execute(actor: Actor, input: RemoveTaskCommentInput): Promise<void> {
    const task = await this.loadTask(actor, input.taskId)
    const comment = await this.loadComment(actor, task, input.commentId)
    if (!canRemoveComment(actor, task, comment))
      throw new PermissionDeniedError('Sem permissão para remover este comentário')
    const now = await this.deps.clock.now(actor.organizationId)
    const updated: Task = { ...task, updatedAt: now }
    const events = await this.timelineEvents(actor, task.id, now, [commentRemovedDraft(comment)])
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.comments.remove(actor.organizationId, comment.id)
      await repositories.tasks.save(actor.organizationId, updated)
      await repositories.timeline.saveMany(actor.organizationId, events)
    })
    await this.publish(actor, task)
  }
}
