import type { Task } from '../entities/task'
import { isInBacklog } from '../entities/task'
import { ValidationError } from '../shared/errors'
import type { TaskId } from '../shared/ids'

/**
 * Ordenação do backlog (M3.1). Escolha: rank inteiro com espaçamento de `BACKLOG_RANK_GAP`.
 * - Inteiro: ordena igual em SQLite e Postgres (PLANO 3.7), sem colação nem comparação de texto.
 * - Entre dois vizinhos cabe o ponto médio. Quando não cabe mais inteiro entre eles (a diferença
 *   é 1 ou 0), `rankBetween` devolve nulo e `reorderInBacklog` renumera o backlog inteiro com
 *   espaçamento de novo: só as posições que mudaram são gravadas.
 * - Empate (dois itens com o mesmo rank, que o banco nunca deveria ter) se resolve pela data de
 *   criação e depois pelo id, então a ordem é estável e igual em qualquer leitura.
 */
export const BACKLOG_RANK_GAP = 1024

/**
 * Visibilidade no quadro e nas visões padrão (M3.1): item de backlog fica fora do quadro, das listas
 * da bandeja, da busca, do dashboard e da agenda. Só as consultas do backlog o mostram.
 */
export function showsOnBoard(task: Pick<Task, 'backlogRank'>): boolean {
  return !isInBacklog(task)
}

/** Item de backlog: só os campos que a ordenação lê. */
export type BacklogItem = Pick<Task, 'id' | 'backlogRank' | 'createdAt'>

export interface BacklogRankChange {
  readonly taskId: TaskId
  readonly backlogRank: number
}

/** Onde a tarefa cai: no topo, no fim, ou entre dois vizinhos (um deles basta). */
export type BacklogPlacement =
  | { readonly to: 'top' }
  | { readonly to: 'end' }
  | { readonly to: 'between'; readonly afterId: TaskId | null; readonly beforeId: TaskId | null }

export interface BacklogMove {
  /** Só as posições que mudam. Vazio = a tarefa já estava ali (nada a gravar). */
  readonly changes: readonly BacklogRankChange[]
  /** Posição final da tarefa no backlog, de 1 em diante. */
  readonly position: number
}

/** Ordem do backlog: rank crescente, depois data de criação e id. */
export function compareBacklogOrder(a: BacklogItem, b: BacklogItem): number {
  const rankA = a.backlogRank ?? Number.MAX_SAFE_INTEGER
  const rankB = b.backlogRank ?? Number.MAX_SAFE_INTEGER
  return rankA - rankB || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/** Só os itens de backlog, na ordem do backlog. Não altera a lista recebida. */
export function sortBacklog<T extends BacklogItem>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => isInBacklog(task)).sort(compareBacklogOrder)
}

/**
 * Rank entre dois vizinhos (nulo = sem vizinho desse lado). Devolve nulo quando não há inteiro
 * livre entre eles, sinal para renumerar o backlog.
 */
export function rankBetween(before: number | null, after: number | null): number | null {
  let rank: number
  if (before === null && after === null) rank = BACKLOG_RANK_GAP
  else if (before === null) rank = (after ?? 0) - BACKLOG_RANK_GAP
  else if (after === null) rank = before + BACKLOG_RANK_GAP
  else {
    if (after - before < 2) return null
    rank = before + Math.floor((after - before) / 2)
  }
  return Number.isSafeInteger(rank) ? rank : null
}

/** Rank para o fim do backlog, depois do último item. */
export function rankAtEnd(backlog: readonly BacklogItem[]): number {
  const last = sortBacklog(backlog).at(-1)?.backlogRank ?? null
  return rankBetween(last, null) ?? BACKLOG_RANK_GAP
}

/** Renumera a lista inteira na ordem recebida, com espaçamento. */
export function rebalanceBacklog(ids: readonly TaskId[]): BacklogRankChange[] {
  return ids.map((taskId, index) => ({ taskId, backlogRank: (index + 1) * BACKLOG_RANK_GAP }))
}

/** Índice (na lista sem a tarefa movida) em que ela deve entrar. */
function insertionIndex(others: readonly BacklogItem[], placement: BacklogPlacement): number {
  if (placement.to === 'top') return 0
  if (placement.to === 'end') return others.length
  const { afterId, beforeId } = placement
  if (afterId === null && beforeId === null)
    throw new ValidationError('Informe o vizinho da nova posição')
  const afterIndex = afterId === null ? null : others.findIndex((task) => task.id === afterId)
  const beforeIndex = beforeId === null ? null : others.findIndex((task) => task.id === beforeId)
  if (afterIndex === -1 || beforeIndex === -1)
    throw new ValidationError('O vizinho não está no backlog deste projeto')
  if (afterIndex !== null && beforeIndex !== null) {
    if (beforeIndex !== afterIndex + 1)
      throw new ValidationError('Os vizinhos precisam estar um ao lado do outro')
    return beforeIndex
  }
  return afterIndex !== null ? afterIndex + 1 : (beforeIndex ?? 0)
}

/**
 * Reordena um item do backlog. Calcula o rank da tarefa entre os vizinhos; se não houver espaço
 * inteiro, renumera o backlog do projeto. Não grava nada: devolve o que mudou.
 */
export function reorderInBacklog(
  backlog: readonly BacklogItem[],
  taskId: TaskId,
  placement: BacklogPlacement,
): BacklogMove {
  const ordered = sortBacklog(backlog)
  const current = ordered.find((task) => task.id === taskId)
  if (!current) throw new ValidationError('Tarefa não está no backlog deste projeto')
  if (placement.to === 'between' && (placement.afterId === taskId || placement.beforeId === taskId))
    throw new ValidationError('A tarefa não pode ser vizinha dela mesma')

  const others = ordered.filter((task) => task.id !== taskId)
  const index = insertionIndex(others, placement)
  const position = index + 1
  // Mesma posição de antes: nada a gravar.
  if (ordered.indexOf(current) === index) return { changes: [], position }

  const before = others[index - 1]?.backlogRank ?? null
  const after = others[index]?.backlogRank ?? null
  const rank = rankBetween(before, after)
  if (rank !== null) return { changes: [{ taskId, backlogRank: rank }], position }

  const nextOrder = [...others.slice(0, index), current, ...others.slice(index)].map(
    (task) => task.id,
  )
  const previous = new Map(ordered.map((task) => [task.id, task.backlogRank]))
  const changes = rebalanceBacklog(nextOrder).filter(
    (change) => previous.get(change.taskId) !== change.backlogRank,
  )
  return { changes, position }
}
