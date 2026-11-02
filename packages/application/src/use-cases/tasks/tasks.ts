import {
  addParticipant,
  createParticipation,
  changeResponsible,
  toUserId,
  ValidationError,
  staleDays,
  toDateOnly,
  canCreateTask,
  canEditTask,
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
  setArchivedAt,
  setDeadline,
  setDescription,
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

export class CreateTask {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CreateTaskInput): Promise<TaskDto> {
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
    const user = await this.deps.users.findById(actor.organizationId, actor.userId)
    if (!user) throw new NotFoundError('Usuário não encontrado')
    const now = await this.deps.clock.now(actor.organizationId)
    const initialTask = createTask({
      id: toTaskId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
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
    let task = input.status === undefined ? initialTask : setStatus(initialTask, input.status)
    if (input.deadline !== undefined)
      task = setDeadline(task, input.deadline === null ? null : parseDateOnly(input.deadline))
    if (input.responsibleId !== undefined && input.responsibleId !== actor.userId) {
      const responsibleId = toUserId(input.responsibleId)
      const responsible = await this.deps.users.findById(actor.organizationId, responsibleId)
      if (!responsible) throw new NotFoundError('Responsável não encontrado')
      task = addParticipant(
        task,
        createParticipation({
          id: toParticipationId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId: task.id,
          participant: { kind: 'user', userId: responsibleId },
          role: 'support',
          hoursHundredths: 0,
          rateCents: responsible.defaultRateCents,
          addedAt: now,
        }),
      )
      task = changeResponsible(task, responsibleId)
    }
    const event = createTimelineEvent({
      id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
      taskId: task.id,
      at: now,
      actorUserId: actor.userId,
      asManager: isManagerEdit(actor),
      type: 'task_created',
      payload: {},
    })
    const initialEvents = await Promise.all(
      diffTask(initialTask, task).map(async (draft) =>
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
      await repositories.tasks.save(actor.organizationId, task)
      await repositories.timeline.saveMany(actor.organizationId, [event, ...initialEvents])
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    return toTaskDto(task)
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
    const now = await this.deps.clock.now(actor.organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const events =
      task.status === 'in_progress' || task.status === 'review'
        ? await this.deps.timeline.listByTask(actor.organizationId, task.id)
        : []
    return {
      ...toTaskDetailDto(task, actor, isMember, names),
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

abstract class ChangeTask {
  constructor(protected readonly deps: AppDeps) {}

  protected async change(
    actor: Actor,
    rawTaskId: string,
    transform: (task: Task, now: string) => Task,
    extraEvents: readonly TimelineEventDraft[] = [],
  ): Promise<TaskDto> {
    const taskId = toTaskId(rawTaskId)
    const task = await this.deps.tasks.findById(actor.organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    if (!canEditTask(actor, task))
      throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
    const now = await this.deps.clock.now(actor.organizationId)
    const changed = transform(task, now)
    const updated: Task = { ...changed, updatedAt: now }
    const drafts = [...diffTask(task, updated), ...extraEvents]
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
    return toTaskDto(updated)
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

export class MoveTask extends ChangeTask {
  async execute(
    actor: Actor,
    input: { readonly taskId: string; readonly status: Task['status'] },
  ): Promise<TaskDto> {
    return this.change(actor, input.taskId, (task) => setStatus(task, input.status))
  }
}

export class ArchiveTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }): Promise<TaskDto> {
    return this.change(actor, input.taskId, (task, now) => setArchivedAt(task, now))
  }
}

export class UnarchiveTask extends ChangeTask {
  async execute(actor: Actor, input: { readonly taskId: string }): Promise<TaskDto> {
    return this.change(actor, input.taskId, (task) => setArchivedAt(task, null))
  }
}

export type { TaskId }
