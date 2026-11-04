import type { TaskDto } from '@agilebox/contract'

/** Dias sem mudança de estado a partir dos quais a tarefa conta como parada. */
export const AGING_THRESHOLD_DAYS = 4

/** Bloqueio é uma marca com motivo, não um estado. */
export function isBlockedTask(task: Pick<TaskDto, 'blockedReason'>): boolean {
  return task.blockedReason !== null
}

/**
 * Parada: passou do limite e não está bloqueada. Bloqueio já declara a causa da parada,
 * então o servidor também não a conta (ver `isStaleTask` no core).
 */
export function isAgingTask(task: Pick<TaskDto, 'agingDays' | 'blockedReason'>): boolean {
  return !isBlockedTask(task) && (task.agingDays ?? 0) > AGING_THRESHOLD_DAYS
}
