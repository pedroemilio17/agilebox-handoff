import {
  acceptanceEventDraft,
  addAcceptanceCriterion,
  changedAcceptancePositions,
  createTimelineEvent,
  isManagerEdit,
  moveAcceptanceCriterion,
  NotFoundError,
  removeAcceptanceCriterion,
  renameAcceptanceCriterion,
  setAcceptanceDone,
  toAcceptanceCriterionId,
  toEventId,
  toTaskId,
} from '@agilebox/core'
import type {
  AcceptanceCriterion,
  AcceptanceCriterionId,
  Actor,
  Task,
  TimelineEventDraft,
} from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from './task-prefix'
import { loadCommentCounts } from './comment-loader'
import { assertTaskEditable } from './task-access'

export interface AddAcceptanceCriterionInput {
  readonly taskId: string
  readonly text: string
}
export interface ToggleAcceptanceCriterionInput {
  readonly taskId: string
  readonly criterionId: string
  readonly done: boolean
}
export interface RenameAcceptanceCriterionInput {
  readonly taskId: string
  readonly criterionId: string
  readonly text: string
}
export interface RemoveAcceptanceCriterionInput {
  readonly taskId: string
  readonly criterionId: string
}
export interface MoveAcceptanceCriterionInput {
  readonly taskId: string
  readonly criterionId: string
  readonly position: number
}

interface CriteriaStep {
  /** Critérios que precisam ser gravados (novos, alterados ou reposicionados). */
  readonly changed: readonly AcceptanceCriterion[]
  readonly removedId?: AcceptanceCriterionId
  readonly drafts: readonly TimelineEventDraft[]
}

/**
 * Critérios de aceitação (M3.2). Mesma política das subtarefas: quem edita a tarefa edita os critérios,
 * e o gestor fica marcado. Tarefa arquivada não edita (assertTaskEditable). O módulo `acceptance` é
 * verificado pelo guard, no mapa de `create-use-cases.ts`.
 */
abstract class ChangeAcceptance {
  constructor(protected readonly deps: AppDeps) {}

  protected async load(
    actor: Actor,
    rawTaskId: string,
  ): Promise<{ readonly task: Task; readonly items: readonly AcceptanceCriterion[] }> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    assertTaskEditable(actor, task)
    const items = await this.deps.acceptance.listByTask(actor.organizationId, task.id)
    return { task, items }
  }

  protected findCriterion(
    items: readonly AcceptanceCriterion[],
    criterionId: string,
  ): AcceptanceCriterion {
    const id = toAcceptanceCriterionId(criterionId)
    const criterion = items.find((candidate) => candidate.id === id)
    if (!criterion) throw new NotFoundError('Critério não encontrado')
    return criterion
  }

  protected async persist(actor: Actor, task: Task, step: CriteriaStep): Promise<TaskDto> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    const checklist = await this.deps.checklist.listByTask(actor.organizationId, task.id)
    const counts = await loadCommentCounts(this.deps, actor, [task])
    const commentCount = counts.get(task.id) ?? 0
    const criteria = await this.deps.acceptance.listByTask(actor.organizationId, task.id)
    if (step.changed.length === 0 && step.removedId === undefined)
      return toTaskDto(task, prefix, checklist, commentCount, criteria)
    const now = await this.deps.clock.now(actor.organizationId)
    const updated: Task = { ...task, updatedAt: now }
    const events = await Promise.all(
      step.drafts.map(async (draft) =>
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
      if (step.removedId !== undefined)
        await repositories.acceptance.remove(actor.organizationId, step.removedId)
      if (step.changed.length > 0)
        await repositories.acceptance.saveMany(actor.organizationId, step.changed)
      if (events.length > 0) await repositories.timeline.saveMany(actor.organizationId, events)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    const saved = await this.deps.acceptance.listByTask(actor.organizationId, task.id)
    return toTaskDto(updated, prefix, checklist, commentCount, saved)
  }
}

export class AddAcceptanceCriterion extends ChangeAcceptance {
  async execute(actor: Actor, input: AddAcceptanceCriterionInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const now = await this.deps.clock.now(actor.organizationId)
    const criterion = addAcceptanceCriterion(task, items, {
      id: toAcceptanceCriterionId(await this.deps.idGenerator.generate(actor.organizationId)),
      text: input.text,
      createdAt: now,
    })
    return this.persist(actor, task, {
      changed: [criterion],
      drafts: [acceptanceEventDraft('acceptance_criterion_added', criterion)],
    })
  }
}

export class ToggleAcceptanceCriterion extends ChangeAcceptance {
  async execute(actor: Actor, input: ToggleAcceptanceCriterionInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findCriterion(items, input.criterionId)
    const now = await this.deps.clock.now(actor.organizationId)
    const next = setAcceptanceDone(task, current, input.done, now)
    if (next === current) return this.persist(actor, task, { changed: [], drafts: [] })
    return this.persist(actor, task, {
      changed: [next],
      drafts: [
        acceptanceEventDraft(
          next.done ? 'acceptance_criterion_done' : 'acceptance_criterion_reopened',
          next,
        ),
      ],
    })
  }
}

export class RenameAcceptanceCriterion extends ChangeAcceptance {
  async execute(actor: Actor, input: RenameAcceptanceCriterionInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findCriterion(items, input.criterionId)
    const now = await this.deps.clock.now(actor.organizationId)
    const next = renameAcceptanceCriterion(task, current, input.text, now)
    return this.persist(actor, task, {
      changed: next === current ? [] : [next],
      drafts:
        next === current
          ? []
          : [
              {
                type: 'acceptance_criterion_renamed',
                payload: { criterionId: next.id, before: current.text, after: next.text },
              },
            ],
    })
  }
}

export class RemoveAcceptanceCriterion extends ChangeAcceptance {
  async execute(actor: Actor, input: RemoveAcceptanceCriterionInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findCriterion(items, input.criterionId)
    const { removed, remaining } = removeAcceptanceCriterion(task, items, current.id)
    return this.persist(actor, task, {
      changed: changedAcceptancePositions(items, remaining),
      removedId: removed.id,
      drafts: [acceptanceEventDraft('acceptance_criterion_removed', removed)],
    })
  }
}

export class MoveAcceptanceCriterion extends ChangeAcceptance {
  async execute(actor: Actor, input: MoveAcceptanceCriterionInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findCriterion(items, input.criterionId)
    const next = moveAcceptanceCriterion(task, items, current.id, input.position)
    const moved = next.find((criterion) => criterion.id === current.id)
    if (!moved) throw new NotFoundError('Critério não encontrado')
    const changed = changedAcceptancePositions(items, next)
    return this.persist(actor, task, {
      changed,
      drafts:
        changed.length === 0
          ? []
          : [
              {
                type: 'acceptance_criterion_moved',
                payload: {
                  criterionId: moved.id,
                  text: moved.text,
                  before: current.position,
                  after: moved.position,
                },
              },
            ],
    })
  }
}
