import { ValidationError } from '../shared/errors'
import type { TaskId } from '../shared/ids'
import { canUseExistingItems } from '../modules/module-state'
import type { ModuleState } from '../modules/module-state'

/**
 * Ordem do backlog do time (B1 A, B2 A) e visibilidade no quadro.
 *
 * Estratégia de ordem: `backlogRank` é um inteiro contíguo a partir de 1 dentro do conjunto de
 * tarefas do backlog que o chamador passa (normalmente, o time sem arquivadas). Ao mover uma
 * tarefa, todo o conjunto é renumerado de 1 a n. Assim não há colisão nem lacuna, e não é preciso
 * ponto médio nem renormalização tardia. Só as tarefas cuja posição mudou entram na lista de
 * alterações, que é o que a persistência grava. Custo: O(n log n) por movimento, folgado para
 * backlogs de times pequenos.
 * Descartado: ranks esparsos (ex.: 1000, 2000) com ponto médio. Exige renormalização quando o
 * espaço acaba e não entrega a "ordem contígua" pedida no M3.1.
 */

export interface BacklogItem {
  readonly id: TaskId
  readonly backlogRank: number | null
}

export interface BacklogRankChange {
  readonly id: TaskId
  readonly backlogRank: number
}

/** `'top'` = posição 0, `'end'` = último, ou um índice 0-based dentro do backlog ordenado. */
export type BacklogPlacement = 'top' | 'end' | number

type RankedItem<T extends BacklogItem> = T & { readonly backlogRank: number }

function isRanked<T extends BacklogItem>(item: T): item is RankedItem<T> {
  return item.backlogRank !== null
}

/** Posição válida: inteiro seguro maior ou igual a 1. */
export function parseBacklogRank(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError('Posição do backlog inválida')
  }
  return value
}

export function isInBacklog(item: BacklogItem): boolean {
  return item.backlogRank !== null
}

/** Tarefas do backlog, da primeira posição à última. Quem está fora do backlog não entra. */
export function orderedBacklog<T extends BacklogItem>(items: readonly T[]): T[] {
  return items.filter(isRanked).sort((a, b) => a.backlogRank - b.backlogRank)
}

/** Posição de uma tarefa nova no fim do backlog: depois do maior rank atual, sem colidir. */
export function nextBacklogRank(items: readonly BacklogItem[]): number {
  const highest = items.reduce(
    (max, item) => (item.backlogRank !== null && item.backlogRank > max ? item.backlogRank : max),
    0,
  )
  return highest + 1
}

/**
 * Função pura: não altera `items`. Move a tarefa para `placement` e devolve só as tarefas cuja
 * posição mudou, com o rank final (1..n). Aplicar as alterações deixa o backlog contíguo.
 */
export function moveInBacklog<T extends BacklogItem>(
  items: readonly T[],
  id: TaskId,
  placement: BacklogPlacement,
): BacklogRankChange[] {
  const ordered = orderedBacklog(items)
  const from = ordered.findIndex((item) => item.id === id)
  if (from < 0) throw new ValidationError('Tarefa não está no backlog')

  const last = ordered.length - 1
  const to = placement === 'top' ? 0 : placement === 'end' ? last : placement
  if (!Number.isInteger(to) || to < 0 || to > last) {
    throw new ValidationError('Posição de destino fora do backlog')
  }

  const reordered = [...ordered]
  const [moved] = reordered.splice(from, 1)
  if (moved === undefined) throw new ValidationError('Tarefa não está no backlog')
  reordered.splice(to, 0, moved)

  return reordered.flatMap((item, index) => {
    const backlogRank = index + 1
    return item.backlogRank === backlogRank ? [] : [{ id: item.id, backlogRank }]
  })
}

/**
 * Visibilidade no quadro (B1 A). Com o Backlog ativo ou em encerramento, o quadro mostra só as
 * tarefas `onBoard`. Com o Backlog desligado, tudo volta ao quadro: `onBoard` e `backlogRank`
 * continuam gravados e são ignorados, sem migração de dados.
 */
export function isVisibleOnBoard(
  item: { readonly onBoard: boolean },
  backlogState: ModuleState,
): boolean {
  return !canUseExistingItems(backlogState) || item.onBoard
}
