import { ValidationError } from '../shared/errors'
import type { ChecklistItemId, OrganizationId, TaskId } from '../shared/ids'
import { validateChecklistTitle } from './validation'

/** Subtarefa (checklist) de uma tarefa. Posições são contíguas, de 0 a n-1. */
export interface ChecklistItem {
  readonly id: ChecklistItemId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly title: string
  readonly done: boolean
  readonly position: number
  readonly createdAt: string
  readonly doneAt: string | null
}

export function createChecklistItem(input: ChecklistItem): ChecklistItem {
  const title = validateChecklistTitle(input.title)
  if (!Number.isSafeInteger(input.position) || input.position < 0)
    throw new ValidationError('Posição da subtarefa inválida')
  if (input.done !== (input.doneAt !== null))
    throw new ValidationError('Subtarefa com estado de conclusão inconsistente')
  return { ...input, title }
}
