import {
  addChecklistItem,
  canEditTask,
  changedChecklistPositions,
  checklistEventDraft,
  createTimelineEvent,
  isManagerEdit,
  moveChecklistItem,
  NotFoundError,
  PermissionDeniedError,
  removeChecklistItem,
  renameChecklistItem,
  setChecklistItemDone,
  toChecklistItemId,
  toEventId,
  toTaskId,
} from '@agilebox/core'
import type {
  Actor,
  ChecklistItem,
  ChecklistItemId,
  Task,
  TimelineEventDraft,
} from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { toTaskDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { findTaskPrefix } from './task-prefix'

export interface AddChecklistItemInput {
  readonly taskId: string
  readonly title: string
}
export interface ToggleChecklistItemInput {
  readonly taskId: string
  readonly itemId: string
  readonly done: boolean
}
export interface RenameChecklistItemInput {
  readonly taskId: string
  readonly itemId: string
  readonly title: string
}
export interface RemoveChecklistItemInput {
  readonly taskId: string
  readonly itemId: string
}
export interface MoveChecklistItemInput {
  readonly taskId: string
  readonly itemId: string
  readonly position: number
}

interface ChecklistStep {
  /** Todos os itens da tarefa depois da alteração (para o progresso devolvido). */
  readonly items: readonly ChecklistItem[]
  /** Itens que precisam ser gravados (novos, alterados ou reposicionados). */
  readonly changed: readonly ChecklistItem[]
  readonly removedId?: ChecklistItemId
  readonly drafts: readonly TimelineEventDraft[]
}

/** Mesma política das tarefas: quem edita a tarefa edita as subtarefas (gestor marcado). */
abstract class ChangeChecklist {
  constructor(protected readonly deps: AppDeps) {}

  protected async load(
    actor: Actor,
    rawTaskId: string,
  ): Promise<{ readonly task: Task; readonly items: readonly ChecklistItem[] }> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    if (!canEditTask(actor, task))
      throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
    const items = await this.deps.checklist.listByTask(actor.organizationId, task.id)
    return { task, items }
  }

  protected findItem(items: readonly ChecklistItem[], itemId: string): ChecklistItem {
    const item = items.find((candidate) => candidate.id === toChecklistItemId(itemId))
    if (!item) throw new NotFoundError('Subtarefa não encontrada')
    return item
  }

  protected async persist(actor: Actor, task: Task, step: ChecklistStep): Promise<TaskDto> {
    const prefix = await findTaskPrefix(this.deps, actor.organizationId)
    if (step.changed.length === 0 && step.removedId === undefined)
      return toTaskDto(task, prefix, step.items)
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
        await repositories.checklist.remove(actor.organizationId, step.removedId)
      if (step.changed.length > 0)
        await repositories.checklist.saveMany(actor.organizationId, step.changed)
      if (events.length > 0) await repositories.timeline.saveMany(actor.organizationId, events)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    return toTaskDto(updated, prefix, step.items)
  }
}

export class AddChecklistItem extends ChangeChecklist {
  async execute(actor: Actor, input: AddChecklistItemInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const now = await this.deps.clock.now(actor.organizationId)
    const item = addChecklistItem(task, items, {
      id: toChecklistItemId(await this.deps.idGenerator.generate(actor.organizationId)),
      title: input.title,
      createdAt: now,
    })
    return this.persist(actor, task, {
      items: [...items, item],
      changed: [item],
      drafts: [checklistEventDraft('checklist_item_added', item)],
    })
  }
}

export class ToggleChecklistItem extends ChangeChecklist {
  async execute(actor: Actor, input: ToggleChecklistItemInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findItem(items, input.itemId)
    const now = await this.deps.clock.now(actor.organizationId)
    const next = setChecklistItemDone(current, input.done, now)
    if (next === current) return this.persist(actor, task, { items, changed: [], drafts: [] })
    return this.persist(actor, task, {
      items: items.map((item) => (item.id === next.id ? next : item)),
      changed: [next],
      drafts: [
        checklistEventDraft(next.done ? 'checklist_item_done' : 'checklist_item_reopened', next),
      ],
    })
  }
}

export class RenameChecklistItem extends ChangeChecklist {
  async execute(actor: Actor, input: RenameChecklistItemInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findItem(items, input.itemId)
    const next = renameChecklistItem(current, input.title)
    // Renomear não gera evento na linha do tempo.
    return this.persist(actor, task, {
      items: items.map((item) => (item.id === next.id ? next : item)),
      changed: next === current ? [] : [next],
      drafts: [],
    })
  }
}

export class RemoveChecklistItem extends ChangeChecklist {
  async execute(actor: Actor, input: RemoveChecklistItemInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findItem(items, input.itemId)
    const { removed, remaining } = removeChecklistItem(items, current.id)
    return this.persist(actor, task, {
      items: remaining,
      changed: changedChecklistPositions(items, remaining),
      removedId: removed.id,
      drafts: [checklistEventDraft('checklist_item_removed', removed)],
    })
  }
}

export class MoveChecklistItem extends ChangeChecklist {
  async execute(actor: Actor, input: MoveChecklistItemInput): Promise<TaskDto> {
    const { task, items } = await this.load(actor, input.taskId)
    const current = this.findItem(items, input.itemId)
    // Reordenar não gera evento na linha do tempo.
    const next = moveChecklistItem(items, current.id, input.position)
    return this.persist(actor, task, {
      items: next,
      changed: changedChecklistPositions(items, next),
      drafts: [],
    })
  }
}
