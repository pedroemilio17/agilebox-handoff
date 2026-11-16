import { ValidationError } from '../shared/errors'
import type { AcceptanceCriterionId, OrganizationId, TaskId } from '../shared/ids'
import { validateAcceptanceText } from './validation'

/**
 * Critério de aceitação de uma tarefa (M3.2). Lista ordenada por `position`, de 0 a n-1. Serve para
 * a tarefa ficar pronta para planejar: não bloqueia concluir a tarefa nem substitui a definição de
 * pronto do projeto.
 */
export interface AcceptanceCriterion {
  readonly id: AcceptanceCriterionId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly text: string
  readonly done: boolean
  readonly position: number
  readonly createdAt: string
  readonly updatedAt: string
}

export function createAcceptanceCriterion(input: AcceptanceCriterion): AcceptanceCriterion {
  const text = validateAcceptanceText(input.text)
  if (!Number.isSafeInteger(input.position) || input.position < 0)
    throw new ValidationError('Posição do critério inválida')
  return { ...input, text }
}
