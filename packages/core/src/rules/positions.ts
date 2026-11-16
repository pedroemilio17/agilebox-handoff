import { ValidationError } from '../shared/errors'

/** Item com posição contígua (0 a n-1) dentro de uma lista ordenada: subtarefas, critérios. */
export interface PositionedItem {
  readonly id: string
  readonly position: number
}

export function sortByPosition<T extends PositionedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position)
}

/** Reatribui posições 0..n-1 mantendo a ordem atual. */
export function reindexPositions<T extends PositionedItem>(items: readonly T[]): T[] {
  return items.map((item, position) => (item.position === position ? item : { ...item, position }))
}

/** Itens cuja posição mudou entre `before` e `after` (os que precisam ser gravados). */
export function changedPositions<T extends PositionedItem>(
  before: readonly T[],
  after: readonly T[],
): T[] {
  return after.filter(
    (item) => before.find((previous) => previous.id === item.id)?.position !== item.position,
  )
}

/** Retira o item e reatribui as posições do restante. */
export function removeAndReindex<T extends PositionedItem>(
  items: readonly T[],
  id: string,
  notFoundMessage: string,
): { readonly removed: T; readonly remaining: T[] } {
  const removed = items.find((item) => item.id === id)
  if (!removed) throw new ValidationError(notFoundMessage)
  return {
    removed,
    remaining: reindexPositions(sortByPosition(items.filter((item) => item.id !== id))),
  }
}

/** Move o item para a posição informada (0 a n-1) e reatribui as posições. */
export function moveToPosition<T extends PositionedItem>(
  items: readonly T[],
  id: string,
  position: number,
  messages: { readonly invalidPosition: string; readonly notFound: string },
): T[] {
  if (!Number.isSafeInteger(position) || position < 0 || position >= items.length)
    throw new ValidationError(messages.invalidPosition)
  const ordered = sortByPosition(items)
  const from = ordered.findIndex((item) => item.id === id)
  if (from === -1) throw new ValidationError(messages.notFound)
  const [moved] = ordered.splice(from, 1)
  if (!moved) throw new ValidationError(messages.notFound)
  ordered.splice(position, 0, moved)
  return reindexPositions(ordered)
}
