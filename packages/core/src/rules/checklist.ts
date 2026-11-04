import type { ChecklistItem } from '../entities/checklist-item'
import { createChecklistItem } from '../entities/checklist-item'
import type { Task } from '../entities/task'
import type { TimelineEventDraft } from './timeline'
import { CHECKLIST_MAX_ITEMS, validateChecklistTitle } from '../entities/validation'
import { ValidationError } from '../shared/errors'
import type { ChecklistItemId } from '../shared/ids'

export interface ChecklistProgress {
  readonly done: number
  readonly total: number
  readonly percent: number
}

export function checklistProgress(items: readonly ChecklistItem[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((item) => item.done).length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

function sortByPosition(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => a.position - b.position)
}

/** Reatribui posições 0..n-1 mantendo a ordem atual. */
function reindex(items: readonly ChecklistItem[]): ChecklistItem[] {
  return items.map((item, position) => (item.position === position ? item : { ...item, position }))
}

/** Itens cuja posição mudou entre `before` e `after` (os que precisam ser gravados). */
export function changedChecklistPositions(
  before: readonly ChecklistItem[],
  after: readonly ChecklistItem[],
): ChecklistItem[] {
  return after.filter(
    (item) => before.find((previous) => previous.id === item.id)?.position !== item.position,
  )
}

/** Nova subtarefa vai para o fim. Só tarefa não concluída aceita itens novos. */
export function addChecklistItem(
  task: Task,
  items: readonly ChecklistItem[],
  draft: { readonly id: ChecklistItemId; readonly title: string; readonly createdAt: string },
): ChecklistItem {
  if (task.status === 'done')
    throw new ValidationError('Tarefa concluída não aceita novas subtarefas')
  if (items.length >= CHECKLIST_MAX_ITEMS)
    throw new ValidationError(`Limite de ${CHECKLIST_MAX_ITEMS} subtarefas por tarefa`)
  return createChecklistItem({
    id: draft.id,
    organizationId: task.organizationId,
    taskId: task.id,
    title: draft.title,
    done: false,
    position: items.length,
    createdAt: draft.createdAt,
    doneAt: null,
  })
}

export function setChecklistItemDone(
  item: ChecklistItem,
  done: boolean,
  at: string,
): ChecklistItem {
  if (item.done === done) return item
  return { ...item, done, doneAt: done ? at : null }
}

export function renameChecklistItem(item: ChecklistItem, title: string): ChecklistItem {
  const next = validateChecklistTitle(title)
  return next === item.title ? item : { ...item, title: next }
}

export function removeChecklistItem(
  items: readonly ChecklistItem[],
  id: ChecklistItemId,
): { readonly removed: ChecklistItem; readonly remaining: ChecklistItem[] } {
  const removed = items.find((item) => item.id === id)
  if (!removed) throw new ValidationError('Subtarefa não encontrada')
  return {
    removed,
    remaining: reindex(sortByPosition(items.filter((item) => item.id !== id))),
  }
}

/** Move a subtarefa para a posição informada (0 a n-1) e reatribui as posições. */
export function moveChecklistItem(
  items: readonly ChecklistItem[],
  id: ChecklistItemId,
  position: number,
): ChecklistItem[] {
  if (!Number.isSafeInteger(position) || position < 0 || position >= items.length)
    throw new ValidationError('Posição da subtarefa inválida')
  const ordered = sortByPosition(items)
  const from = ordered.findIndex((item) => item.id === id)
  if (from === -1) throw new ValidationError('Subtarefa não encontrada')
  const [moved] = ordered.splice(from, 1)
  if (!moved) throw new ValidationError('Subtarefa não encontrada')
  ordered.splice(position, 0, moved)
  return reindex(ordered)
}

export type ChecklistEventType =
  | 'checklist_item_added'
  | 'checklist_item_done'
  | 'checklist_item_reopened'
  | 'checklist_item_removed'

export function checklistEventDraft(
  type: ChecklistEventType,
  item: ChecklistItem,
): TimelineEventDraft {
  return { type, payload: { itemId: item.id, title: item.title } }
}
