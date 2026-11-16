import {
  addParticipant,
  addToBacklog,
  setEstimatedHours,
  archiveTask,
  blockTask,
  canChangeTaskArchive,
  canPullFromBacklog,
  isInBacklog,
  rankAtEnd,
  unarchiveTask,
  unblockTask,
  ConflictError,
  createParticipation,
  changeResponsible,
  toUserId,
  ValidationError,
  staleDays,
  toDateOnly,
  canCreateTask,
  canViewTask,
  createTask,
  createTicket,
  createTimelineEvent,
  diffTask,
  isManagerEdit,
  NotFoundError,
  parseDateOnly,
  PermissionDeniedError,
  renameTask,
  setDeadline,
  setDescription,
  setPriority,
  setStatus,
  setTicket,
  toEventId,
  toProjectId,
  toTaskId,
  toParticipationId,
} from '@agilebox/core'
import type {
  Actor,
  ContributorId,
  Task,
  TaskId,
  TimelineNames,
  TimelineEventDraft,
  UserId,
} from '@agilebox/core'
import type { CreateTaskInput, GetTaskDto, TaskDto, TaskUpdateInput } from '@agilebox/contract'
import { toTaskDetailDto, toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from './task-prefix'
import { loadCommentCounts } from './comment-loader'
import { loadCommentDtos } from './comments'
import { definitionOfDoneCompletion } from './definition-of-done-guard'
import { assertTaskEditable } from './task-access'
import { assertBacklogAccess } from '../backlog/backlog-access'
import type { BacklogPolicy } from '../backlog/backlog-access'

export interface CreateTaskOptions {
  /** Cria o item direto no backlog do projeto (M3.1): fora do quadro, em Planejamento. */
  readonly backlog?: boolean
}

export class CreateTask {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    actor: Actor,
    input: CreateTaskInput,
    options: CreateTaskOptions = {},
  ): Promise<TaskDto> {
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(actor.organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(actor.organizationId, projectId)
    if (
      !canCreateTask(
        actor,
        project,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem permissão para criar tarefa neste projeto')
    if (project.archivedAt !== null)
      throw new ConflictError(
        'Projeto arquivado não aceita novas tarefas. Desarquive o projeto para criar.',
      )
    const user = await this.deps.users.findById(actor.organizationId, actor.userId)
    if (!user) throw new NotFoundError('Usuário não encontrado')
    const now = await this.deps.clock.now(actor.organizationId)
    const task = await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      const number = await repositories.tasks.nextNumber(actor.organizationId)
      const initialTask = createTask({
        id: toTaskId(await this.deps.idGenerator.generate(actor.organizationId)),
        organizationId: actor.organizationId,
        number,
        projectId,
        projectName: project.name,
        createdBy: actor.userId,
        title: input.title,
        createdAt: now,
        responsibleParticipationId: toParticipationId(
          await this.deps.idGenerator.generate(actor.organizationId),
        ),
        responsibleRateCents: user.defaultRateCents,
      })
      let created = input.status === undefined ? initialTask : setStatus(initialTask, input.status)
      const definitionEvents = await definitionOfDoneCompletion(
        repositories.definitionOfDone,
        actor.organizationId,
        projectId,
        initialTask.status,
        created.status,
        input.confirmedDefinitionItemIds ?? [],
      )
      if (input.deadline !== undefined)
        created = setDeadline(
          created,
          input.deadline === null ? null : parseDateOnly(input.deadline),
        )
      const backlogDrafts: TimelineEventDraft[] = []
      if (options.backlog === true) {
        created = addToBacklog(
          created,
          rankAtEnd(await repositories.tasks.listBacklog(actor.organizationId, projectId)),
        )
        backlogDrafts.push({ type: 'task_added_to_backlog', payload: {} })
      }
      if (input.responsibleId !== undefined && input.responsibleId !== actor.userId) {
        const responsibleId = toUserId(input.responsibleId)
        const responsible = await this.deps.users.findById(actor.organizationId, responsibleId)
        if (!responsible) throw new NotFoundError('Responsável não encontrado')
        created = addParticipant(
          created,
          createParticipation({
            id: toParticipationId(await this.deps.idGenerator.generate(actor.organizationId)),
            taskId: created.id,
            participant: { kind: 'user', userId: responsibleId },
            role: 'support',
            hoursHundredths: 0,
            rateCents: responsible.defaultRateCents,
            addedAt: now,
          }),
        )
        created = changeResponsible(created, responsibleId)
      }
      const event = createTimelineEvent({
        id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
        taskId: created.id,
        at: now,
        actorUserId: actor.userId,
        asManager: isManagerEdit(actor),
        type: 'task_created',
        payload: {},
      })
      const initialEvents = await Promise.all(
        [...diffTask(initialTask, created), ...definitionEvents, ...backlogDrafts].map(
          async (draft) =>
            createTimelineEvent({
              ...draft,
              id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
              taskId: created.id,
              at: now,
              actorUserId: actor.userId,
              asManager: isManagerEdit(actor),
            }),
        ),
      )
      await repositories.tasks.save(actor.organizationId, created)
      await repositories.timeline.saveMany(actor.organizationId, [event, ...initialEvents])
      return created
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    return toTaskDto(task, await findTaskPrefix(this.deps, actor.organizationId), [], 0)
  }
}

export class GetTaskDetail {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly taskId: string }): Promise<GetTaskDto> {
    const task = await this.getTask(actor.organizationId, input.taskId)
    const members = await this.deps.projects.listMembers(actor.organizationId, task.projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canViewTask(actor, task, isMember))
      throw new PermissionDeniedError('Sem acesso a esta tarefa')
    const names = await this.getNames(task)
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const checklist = await this.deps.checklist.listByTask(actor.organizationId, task.id)
    const criteria = await this.deps.acceptance.listByTask(actor.organizationId, task.id)
    const comments = await loadCommentDtos(this.deps, actor, task)
    const definitionOfDone = await this.deps.definitionOfDone.listByProject(
      actor.organizationId,
      task.projectId,
    )
    // Custo estimado usa o padrão do Responsável quando o envolvimento está sem valor (M3.2).
    const responsible = task.participations.find((p) => p.role === 'responsible')
    const responsibleUser =
      responsible?.participant.kind === 'user'
        ? await this.deps.users.findById(actor.organizationId, responsible.participant.userId)
        : null
    const events =
      task.status === 'in_progress' || task.status === 'review'
        ? await this.deps.timeline.listByTask(actor.organizationId, task.id)
        : []
    return {
      ...toTaskDetailDto(
        task,
        prefix,
        actor,
        isMember,
        names,
        checklist,
        comments,
        definitionOfDone,
        criteria,
        responsibleUser?.defaultRateCents ?? 0,
      ),
      agingDays: staleDays(task, events, toDateOnly(new Date(now), timeZone), timeZone),
    }
  }

  private async getTask(organizationId: Actor['organizationId'], rawTaskId: string) {
    const task = await this.deps.tasks.findById(organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    return task
  }

  private async getNames(task: Task): Promise<TimelineNames> {
    const userIds = task.participations.flatMap((item) =>
      item.participant.kind === 'user' ? [item.participant.userId] : [],
    )
    const contributorIds = task.participations.flatMap((item) =>
      item.participant.kind === 'contributor' ? [item.participant.contributorId] : [],
    )
    const [users, contributors] = await Promise.all([
      Promise.all(userIds.map((id) => this.deps.users.findById(task.organizationId, id))),
      Promise.all(
        contributorIds.map((id) => this.deps.contributors.findById(task.organizationId, id)),
      ),
    ])
    const userNames = new Map<UserId, string>()
    users.forEach((user, index) => {
      const id = userIds[index]
      if (user && id) userNames.set(id, user.name)
    })
    const contributorNames = new Map<ContributorId, string>()
    contributors.forEach((contributor, index) => {
      const id = contributorIds[index]
      if (contributor && id) contributorNames.set(id, contributor.name)
    })
    return {
      organizationId: task.organizationId,
      user: (id) => userNames.get(id) ?? 'Usuário',
      contributor: (id) => contributorNames.get(id) ?? 'Entidade',
    }
  }
}

export abstract class ChangeTask {
  constructor(protected readonly deps: AppDeps) {}

  /**
   * `archive`: só arquivar/desarquivar, que vale também para tarefa arquivada.
   * `backlog`: puxar/devolver ao backlog; vale para o membro do projeto e o gestor (não só quem participa).
   */
  protected async change(
    actor: Actor,
    rawTaskId: string,
    transform: (task: Task, now: string) => Task,
    extraEvents: readonly TimelineEventDraft[] = [],
    confirmedDefinitionItemIds: readonly string[] = [],
    access: 'edit' | 'archive' | 'backlog' = 'edit',
    backlogPolicy: BacklogPolicy = canPullFromBacklog,
  ): Promise<TaskDto> {
    const taskId = toTaskId(rawTaskId)
    const task = await this.deps.tasks.findById(actor.organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    if (access === 'archive') {
      if (!canChangeTaskArchive(actor, task))
        throw new PermissionDeniedError('Sem permissão para arquivar ou desarquivar esta tarefa')
    } else if (access === 'backlog') {
      await assertBacklogAccess(this.deps, actor, task, backlogPolicy)
    } else assertTaskEditable(actor, task)
    const now = await this.deps.clock.now(actor.organizationId)
    const changed = transform(task, now)
    const updated: Task = { ...changed, updatedAt: now }
    const definitionEvents = await definitionOfDoneCompletion(
      this.deps.definitionOfDone,
      actor.organizationId,
      task.projectId,
      task.status,
      updated.status,
      confirmedDefinitionItemIds,
    )
    const drafts = [...diffTask(task, updated), ...extraEvents, ...definitionEvents]
    const events = await Promise.all(
      drafts.map(async (draft) =>
        createTimelineEvent({
          ...draft,
          id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId: task.id,
          at: now,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
        }),
      ),
    )
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.tasks.save(actor.organizationId, updated)
      if (events.length > 0) await repositories.timeline.saveMany(actor.organizationId, events)
    })
    if (events.length > 0)
      await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    const checklist = await this.deps.checklist.listByTask(actor.organizationId, task.id)
    const counts = await loadCommentCounts(this.deps, actor, [updated])
    return toTaskDto(
      updated,
      await findTaskPrefix(this.deps, actor.organizationId),
      checklist,
      counts.get(task.id) ?? 0,
    )
  }
}

export class UpdateTask extends ChangeTask {
  async execute(actor: Actor, input: TaskUpdateInput): Promise<TaskDto> {
    return this.change(
      actor,
      input.taskId,
      (task) => {
        let updated = task
        if (input.changes.title !== undefined) updated = renameTask(updated, input.changes.title)
        if (input.changes.description !== undefined)
          updated = setDescription(updated, input.changes.description)
        if (input.changes.priority !== undefined)
          updated = setPriority(updated, input.changes.priority)
        if (input.changes.deadline !== undefined)
          updated = setDeadline(
            updated,
            input.changes.deadline === null ? null : parseDateOnly(input.changes.deadline),
          )
        if (input.changes.ticketId !== undefined || input.changes.ticketUrl !== undefined) {
          const ticketId =
            input.changes.ticketId === undefined
              ? (task.ticket?.id ?? null)
              : input.changes.ticketId
          const ticketUrl =
            input.changes.ticketUrl === undefined
              ? (task.ticket?.url ?? null)
              : input.changes.ticketUrl
          updated = setTicket(
            updated,
            ticketId === null ? null : createTicket(ticketId, ticketUrl ?? undefined),
          )
        }
        if (
          input.changes.progressConfirmed &&
          updated.status !== 'in_progress' &&
          updated.status !== 'review'
        )
          throw new ValidationError('Só é possível confirmar tarefas em desenvolvimento ou revisão')
        return updated
      },
      input.changes.progressConfirmed ? [{ type: 'progress_confirmed', payload: {} }] : [],
    )
  }
}

/**
 * Estimativa em horas (M3.2, módulo `estimates.hours`). Fica em `tasks.setEstimate`, e não no
 * `tasks.update`, porque o guard de módulo é por caso de uso: o `update` é do núcleo e não pode
 * deixar a estimativa passar com o módulo desligado. Quem edita a tarefa define a estimativa.
 */
export class SetTaskEstimate extends ChangeTask {
  async execute(
    actor: Actor,
    input: { readonly taskId: string; readonly estimatedHours: number | null },
  ): Promise<TaskDto> {
    return this.change(actor, input.taskId, (task) => setEstimatedHours(task, input.estimatedHours))
  }
}

export class BlockTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string; readonly reason: string }) {
    return this.change(actor, input.taskId, (task, now) => blockTask(task, input.reason, now))
  }
}

export class UnblockTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }) {
    return this.change(actor, input.taskId, (task) => unblockTask(task))
  }
}

/** Arquiva (esconde, nunca apaga). Quem pode editar a tarefa pode arquivar; fica na linha do tempo. */
export class ArchiveTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }): Promise<TaskDto> {
    return this.change(
      actor,
      input.taskId,
      (task, now) => archiveTask(task, actor.userId, now),
      [{ type: 'task_archived', payload: {} }],
      [],
      'archive',
    )
  }
}

/** Desarquiva: a tarefa volta às visões padrão, com o que tinha antes. */
export class UnarchiveTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }): Promise<TaskDto> {
    return this.change(
      actor,
      input.taskId,
      (task) => unarchiveTask(task),
      [{ type: 'task_unarchived', payload: {} }],
      [],
      'archive',
    )
  }
}

export class MoveTask extends ChangeTask {
  async execute(
    actor: Actor,
    input: {
      readonly taskId: string
      readonly status: Task['status']
      readonly confirmedDefinitionItemIds?: readonly string[] | undefined
    },
  ): Promise<TaskDto> {
    return this.change(
      actor,
      input.taskId,
      (task) => {
        // Item de backlog não tem coluna: fica em Planejamento até ser puxado para o quadro.
        if (isInBacklog(task) && input.status !== 'planning')
          throw new ConflictError('Item do backlog não muda de coluna: puxe-o para o quadro antes')
        return setStatus(task, input.status)
      },
      [],
      input.confirmedDefinitionItemIds ?? [],
    )
  }
}

export type { TaskId }
