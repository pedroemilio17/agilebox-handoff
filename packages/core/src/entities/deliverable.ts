import { ValidationError } from '../shared/errors'
import type { DeliverableId, OrganizationId, ProjectId, UserId } from '../shared/ids'
import { assertDeliverablePlacement, validateDeliverablePosition } from '../rules/deliverable-tree'

/** Entrega da EAP (ADR-10): a mesma entidade que o épico. Limite do título igual ao de item de lista. */
export const DELIVERABLE_TITLE_MAX_LENGTH = 200

export interface Deliverable {
  readonly id: DeliverableId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  /** Nulo = entrega de nível 1 (raiz da EAP). */
  readonly parentId: DeliverableId | null
  readonly title: string
  /** Posição entre os irmãos (inteiro não negativo). O código "1.2" não é gravado: ver `deliverableCodes`. */
  readonly position: number
  readonly createdBy: UserId
  readonly createdAt: string
}

export interface CreateDeliverableInput {
  readonly id: DeliverableId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly parentId: DeliverableId | null
  readonly title: string
  readonly position: number
  readonly createdBy: UserId
  readonly createdAt: string
}

export function validateDeliverableTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) throw new ValidationError('Título da entrega obrigatório')
  if (Array.from(trimmed).length > DELIVERABLE_TITLE_MAX_LENGTH)
    throw new ValidationError('Título da entrega deve ter até 200 caracteres')
  return trimmed
}

/**
 * Cria a entrega. `existing` são as entregas do projeto (ou da organização): o pai precisa estar
 * nelas, no mesmo projeto, e a profundidade (máximo de 3 níveis) é conferida.
 */
export function createDeliverable(
  input: CreateDeliverableInput,
  existing: readonly Deliverable[],
): Deliverable {
  const title = validateDeliverableTitle(input.title)
  const position = validateDeliverablePosition(input.position)
  assertDeliverablePlacement(
    { id: input.id, projectId: input.projectId, parentId: input.parentId },
    existing,
    1,
  )
  return {
    id: input.id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    parentId: input.parentId,
    title,
    position,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  }
}

export function renameDeliverable(deliverable: Deliverable, title: string): Deliverable {
  return { ...deliverable, title: validateDeliverableTitle(title) }
}
