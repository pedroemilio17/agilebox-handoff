import { ValidationError } from '../shared/errors'
import type { DefinitionOfDoneItemId, OrganizationId, ProjectId } from '../shared/ids'
import { validateDefinitionOfDoneTitle } from './validation'

/** Limite de itens da definição de pronto por projeto. */
export const DEFINITION_OF_DONE_MAX_ITEMS = 20

/** Item da definição de pronto de um projeto. Posições são contíguas, de 0 a n-1. */
export interface DefinitionOfDoneItem {
  readonly id: DefinitionOfDoneItemId
  readonly organizationId: OrganizationId
  readonly projectId: ProjectId
  readonly title: string
  readonly position: number
}

export function createDefinitionOfDoneItem(input: DefinitionOfDoneItem): DefinitionOfDoneItem {
  const title = validateDefinitionOfDoneTitle(input.title)
  if (!Number.isSafeInteger(input.position) || input.position < 0)
    throw new ValidationError('Posição do item da definição de pronto inválida')
  return { ...input, title }
}
