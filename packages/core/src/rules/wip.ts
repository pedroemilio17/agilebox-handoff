import type { Task } from '../entities/task'
import { WIP_STATUSES } from '../entities/board-settings'
import type { WipLimits, WipStatus } from '../entities/board-settings'

/**
 * Estado de uma coluna em relação ao limite. O limite é sinal, não bloqueio:
 * 'over' não impede mover tarefas para a coluna, só deve ser mostrado na tela.
 */
export type WipState = 'none' | 'ok' | 'at_limit' | 'over'

export function wipStatus(count: number, limit: number | undefined): WipState {
  if (limit === undefined) return 'none'
  if (count > limit) return 'over'
  if (count === limit) return 'at_limit'
  return 'ok'
}

export interface WipColumn {
  readonly status: WipStatus
  readonly count: number
  readonly limit: number | null
  readonly state: WipState
}

/**
 * Contagem por coluna de WIP sobre as tarefas recebidas. Quem chama decide o conjunto:
 * o quadro passa as tarefas que o usuário vê; o dashboard passa todas da organização.
 */
export function wipColumns(tasks: readonly Task[], wipLimits: WipLimits): WipColumn[] {
  return WIP_STATUSES.map((status) => {
    const count = tasks.filter((task) => task.status === status).length
    const limit = wipLimits[status]
    return { status, count, limit: limit ?? null, state: wipStatus(count, limit) }
  })
}

export interface OverWipColumn {
  readonly status: WipStatus
  readonly count: number
  readonly limit: number
}

/** Só as colunas acima do limite (estado 'over'). */
export function overWipColumns(tasks: readonly Task[], wipLimits: WipLimits): OverWipColumn[] {
  return wipColumns(tasks, wipLimits).flatMap((column) =>
    column.state === 'over' && column.limit !== null
      ? [{ status: column.status, count: column.count, limit: column.limit }]
      : [],
  )
}
