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
  nextBacklogRank,
  NotFoundError,
  parseDateOnly,
  PermissionDeniedError,
  renameTask,
  sendToBacklog,
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
  TenantContext,
  ContributorId,
  Task,
  TaskId,
  TimelineNames,
  TimelineEventDraft,
  UserId,
} from '@agilebox/core'
import type { CreateTaskInput, GetTaskDto, TaskDto, TaskUpdateInput } from '@agilebox/contract'
import { toAcceptanceSummaryDto, toTaskDetailDto, toTaskDto } from '../../mappers'
import type { AcceptanceSummaryDto, TaskEstimateDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import type { UnitOfWorkRepositories } from '../../ports'
import { BACKLOG_MODULE, requireModuleAccess } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'

/** Detalhe da tarefa: DTO da tarefa, custos conforme o ator, dias parada e resumo do aceite (M3.6/M3.7). */
export type GetTaskDetailView = GetTaskDto &
  TaskEstimateDto & { readonly acceptance: AcceptanceSummaryDto }

/**
 * Criação. Com `inBacklog` (Q4, M3.5), a tarefa nasce no fim do backlog do time, fora do quadro, e
 * exige o módulo Backlog ativo (criar item novo). Sem a opção, o comportamento é o de sempre.
 * `inBacklog` ainda não está no contrato: entra com a M3.8.
 */
export type CreateTaskUseCaseInput = CreateTaskInput & { readonly inBacklog?: boolean }

export class CreateTask {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor, input: CreateTaskUseCaseInput): Promise<TaskDto> {
    const organizationId = assertTenant(ctx, actor)
    const inBacklog = input.inBacklog === true
    if (inBacklog) await requireModuleAccess(this.deps, organizationId, BACKLOG_MODULE, 'new')
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canCreateTask(
        actor,
        project,
        members.some((member) => member.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError('Sem permissão para criar tarefa neste projeto')
    const user = await this.deps.users.findById(organizationId, actor.userId)
    if (!user) throw new NotFoundError('Usuário não encontrado')
    const now = await this.deps.clock.now(organizationId)
    const initialTask = createTask({
      id: toTaskId(await this.deps.idGenerator.generate(organizationId)),
      organizationId,
      projectId,
      projectName: project.name,
      createdBy: actor.userId,
      title: input.title,
      createdAt: now,
      responsibleParticipationId: toParticipationId(
        await this.deps.idGenerator.generate(organizationId),
      ),
      responsibleRateCents: user.defaultRateCents,
    })
    // Q7 (M3.5): no backlog, a tarefa entra em Planejamento, como ao levar ao quadro; o estado pedido não vale.
    const status = inBacklog ? 'planning' : input.status
    let task = status === undefined ? initialTask : setStatus(initialTask, status)
    if (input.deadline !== undefined)
      task = setDeadline(task, input.deadline === null ? null : parseDateOnly(input.deadline))
    if (input.responsibleId !== undefined && input.responsibleId !== actor.userId) {
      const responsibleId = toUserId(input.responsibleId)
      const responsible = await this.deps.users.findById(organizationId, responsibleId)
      if (!responsible) throw new NotFoundError('Responsável não encontrado')
      task = addParticipant(
        task,
        createParticipation({
          id: toParticipationId(await this.deps.idGenerator.generate(organizationId)),
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
      id: toEventId(await this.deps.idGenerator.generate(organizationId)),
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
          id: toEventId(await this.deps.idGenerator.generate(organizationId)),
          taskId: task.id,
          at: now,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
        }),
      ),
    )
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      // A posição é calculada dentro da transação: duas criações seguidas não recebem o mesmo rank.
      if (inBacklog)
        task = sendToBacklog(
          task,
          nextBacklogRank(await repositories.tasks.listBacklog(organizationId)),
        )
      await repositories.tasks.save(organizationId, task)
      await repositories.timeline.saveMany(organizationId, [event, ...initialEvents])
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [task.id] })
    return toTaskDto(task, actor)
  }
}

export class GetTaskDetail {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<GetTaskDetailView> {
    const organizationId = assertTenant(ctx, actor)
    const task = await this.getTask(organizationId, input.taskId)
    const members = await this.deps.projects.listMembers(organizationId, task.projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canViewTask(actor, task, isMember))
      throw new PermissionDeniedError('Sem acesso a esta tarefa')
    const names = await this.getNames(task)
    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const events =
      task.status === 'in_progress' || task.status === 'review'
        ? await this.deps.timeline.listByTask(organizationId, task.id)
        : []
    const criteria = await this.deps.unitOfWork.run(organizationId, (repositories) =>
      repositories.taskCriteria.listByTask(organizationId, task.id),
    )
    return {
      ...toTaskDetailDto(task, actor, isMember, names),
      agingDays: staleDays(task, events, toDateOnly(new Date(now), timeZone), timeZone),
      acceptance: toAcceptanceSummaryDto(criteria),
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

  /**
   * Lê, transforma e grava a tarefa numa só transação. O `transform` recebe os repositórios da
   * transação, para quem precisa ler o estado do time ao mudar a tarefa (ex.: a posição no backlog).
   */
  protected async change(
    ctx: TenantContext,
    actor: Actor,
    rawTaskId: string,
    transform: (
      task: Task,
      now: string,
      repositories: UnitOfWorkRepositories,
    ) => Promise<Task> | Task,
    extraEvents: readonly TimelineEventDraft[] = [],
  ): Promise<TaskDto> {
    const organizationId = assertTenant(ctx, actor)
    const taskId = toTaskId(rawTaskId)
    const now = await this.deps.clock.now(organizationId)
    const { updated, events } = await this.deps.unitOfWork.run(
      organizationId,
      async (repositories) => {
        const task = await repositories.tasks.findById(organizationId, taskId)
        if (!task) throw new NotFoundError('Tarefa não encontrada')
        if (!canEditTask(actor, task))
          throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
        const changed = await transform(task, now, repositories)
        const next: Task = { ...changed, updatedAt: now }
        const drafts = [...diffTask(task, next), ...extraEvents]
        const timelineEvents = await Promise.all(
          drafts.map(async (draft) =>
            createTimelineEvent({
              ...draft,
              id: toEventId(await this.deps.idGenerator.generate(organizationId)),
              taskId: task.id,
              at: now,
              actorUserId: actor.userId,
              asManager: isManagerEdit(actor),
            }),
          ),
        )
        await repositories.tasks.save(organizationId, next)
        if (timelineEvents.length > 0)
          await repositories.timeline.saveMany(organizationId, timelineEvents)
        return { updated: next, events: timelineEvents }
      },
    )
    if (events.length > 0)
      await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [updated.id] })
    return toTaskDto(updated, actor)
  }
}

export class UpdateTask extends ChangeTask {
  async execute(ctx: TenantContext, actor: Actor, input: TaskUpdateInput): Promise<TaskDto> {
    return this.change(
      ctx,
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
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string; readonly status: Task['status'] },
  ): Promise<TaskDto> {
    return this.change(ctx, actor, input.taskId, (task) => setStatus(task, input.status))
  }
}

export class ArchiveTask extends ChangeTask {
  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<TaskDto> {
    return this.change(ctx, actor, input.taskId, (task, now) => setArchivedAt(task, now))
  }
}

export class UnarchiveTask extends ChangeTask {
  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: { readonly taskId: string },
  ): Promise<TaskDto> {
    return this.change(ctx, actor, input.taskId, async (task, _now, repositories) => {
      const unarchived = setArchivedAt(task, null)
      if (task.backlogRank === null) return unarchived
      // Arquivar não mexe na posição. Enquanto estava fora, outras tarefas podem ter ocupado o
      // rank dela, então volta ao fim do backlog, na mesma transação (M3.5).
      const backlog = await repositories.tasks.listBacklog(task.organizationId)
      return sendToBacklog(unarchived, nextBacklogRank(backlog))
    })
  }
}

export type { TaskId }
