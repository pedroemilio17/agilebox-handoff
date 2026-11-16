import type { TaskDto } from '@agilebox/contract'

/**
 * Pedido de `backlog.reorder` para mover um item. Envia só um vizinho: `beforeId` (o item vai logo
 * antes dele) ou `afterId` (logo depois). O contrato recusa posição e vizinho juntos.
 */
export type BacklogMove =
  | { readonly taskId: string; readonly beforeId: string }
  | { readonly taskId: string; readonly afterId: string }

/**
 * Pedido para levar o item da posição `from` para a posição `to` (índices da lista atual).
 * Null quando não há o que mudar (mesma posição ou fora da lista).
 */
export function moveRequest(
  list: readonly TaskDto[],
  from: number,
  to: number,
): BacklogMove | null {
  if (from === to) return null
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return null
  const task = list[from]!
  const neighbour = list[to]!
  // Subindo, o item cai antes do vizinho; descendo, cai depois dele.
  return to < from
    ? { taskId: task.id, beforeId: neighbour.id }
    : { taskId: task.id, afterId: neighbour.id }
}

/** Lista na nova ordem, para a atualização otimista (o servidor confirma depois). */
export function applyMove(list: readonly TaskDto[], from: number, to: number): TaskDto[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item === undefined) return [...list]
  next.splice(to, 0, item)
  return next
}
