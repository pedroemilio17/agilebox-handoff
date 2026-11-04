import {
  createDefinitionOfDoneItem,
  DEFINITION_OF_DONE_MAX_ITEMS,
} from '../entities/definition-of-done-item'
import type { DefinitionOfDoneItem } from '../entities/definition-of-done-item'
import { DefinitionOfDoneNotConfirmedError, NotFoundError, ValidationError } from '../shared/errors'
import type { DefinitionOfDoneItemId, OrganizationId, ProjectId } from '../shared/ids'
import type { TaskStatus } from '../values/task-status'
import type { TimelineEventDraft } from './timeline'
import { validateDefinitionOfDoneTitle } from '../entities/validation'

function sortByPosition(items: readonly DefinitionOfDoneItem[]): DefinitionOfDoneItem[] {
  return [...items].sort((a, b) => a.position - b.position)
}

/** Reatribui posições 0..n-1 mantendo a ordem atual. */
function reindex(items: readonly DefinitionOfDoneItem[]): DefinitionOfDoneItem[] {
  return items.map((item, position) => (item.position === position ? item : { ...item, position }))
}

/** Itens novos ou alterados (título ou posição) entre `before` e `after`: os que precisam ser gravados. */
export function changedDefinitionItems(
  before: readonly DefinitionOfDoneItem[],
  after: readonly DefinitionOfDoneItem[],
): DefinitionOfDoneItem[] {
  return after.filter((item) => {
    const previous = before.find((candidate) => candidate.id === item.id)
    return previous?.position !== item.position || previous.title !== item.title
  })
}

/** Novo item vai para o fim. Limite de 20 itens por projeto. */
export function addDefinitionItem(
  items: readonly DefinitionOfDoneItem[],
  draft: {
    readonly id: DefinitionOfDoneItemId
    readonly organizationId: OrganizationId
    readonly projectId: ProjectId
    readonly title: string
  },
): DefinitionOfDoneItem[] {
  if (items.length >= DEFINITION_OF_DONE_MAX_ITEMS)
    throw new ValidationError(
      `A definição de pronto aceita até ${DEFINITION_OF_DONE_MAX_ITEMS} itens`,
    )
  const item = createDefinitionOfDoneItem({ ...draft, position: items.length })
  return [...sortByPosition(items), item]
}

export function renameDefinitionItem(
  items: readonly DefinitionOfDoneItem[],
  id: DefinitionOfDoneItemId,
  title: string,
): DefinitionOfDoneItem[] {
  const next = validateDefinitionOfDoneTitle(title)
  if (!items.some((item) => item.id === id)) throw new NotFoundError('Item não encontrado')
  return items.map((item) => (item.id === id ? { ...item, title: next } : item))
}

export function removeDefinitionItem(
  items: readonly DefinitionOfDoneItem[],
  id: DefinitionOfDoneItemId,
): { readonly removed: DefinitionOfDoneItem; readonly remaining: DefinitionOfDoneItem[] } {
  const removed = items.find((item) => item.id === id)
  if (!removed) throw new NotFoundError('Item não encontrado')
  return {
    removed,
    remaining: reindex(sortByPosition(items.filter((item) => item.id !== id))),
  }
}

/** Move o item para a posição informada (0 a n-1) e reatribui as posições. */
export function moveDefinitionItem(
  items: readonly DefinitionOfDoneItem[],
  id: DefinitionOfDoneItemId,
  position: number,
): DefinitionOfDoneItem[] {
  if (!Number.isSafeInteger(position) || position < 0 || position >= items.length)
    throw new ValidationError('Posição do item da definição de pronto inválida')
  const ordered = sortByPosition(items)
  const from = ordered.findIndex((item) => item.id === id)
  if (from === -1) throw new NotFoundError('Item não encontrado')
  const [moved] = ordered.splice(from, 1)
  if (!moved) throw new NotFoundError('Item não encontrado')
  ordered.splice(position, 0, moved)
  return reindex(ordered)
}

/** Itens que a conclusão ainda não confirmou. Ids extras em `confirmedIds` são ignorados. */
export function missingDefinitionItems(
  items: readonly DefinitionOfDoneItem[],
  confirmedIds: readonly string[],
): DefinitionOfDoneItem[] {
  const confirmed = new Set(confirmedIds)
  return sortByPosition(items).filter((item) => !confirmed.has(item.id))
}

/**
 * Conclusão exige a confirmação de TODOS os itens atuais do projeto. Projeto sem itens não exige nada.
 * Itens adicionados depois da última conclusão também precisam ser confirmados.
 */
export function assertDefinitionOfDoneConfirmed(
  items: readonly DefinitionOfDoneItem[],
  confirmedIds: readonly string[],
): void {
  if (items.length === 0) return
  const missing = missingDefinitionItems(items, confirmedIds)
  if (missing.length > 0)
    throw new DefinitionOfDoneNotConfirmedError(
      missing.map((item) => ({ id: item.id, title: item.title })),
    )
}

/** Mudar para Concluído (vindo de outro estado). Sair de Concluído não exige nada. */
export function entersDone(from: TaskStatus, to: TaskStatus): boolean {
  return from !== 'done' && to === 'done'
}

/** Evento da linha do tempo quando a conclusão veio com a definição de pronto confirmada. */
export function definitionConfirmedDraft(count: number): TimelineEventDraft {
  return { type: 'definition_confirmed', payload: { count } }
}
