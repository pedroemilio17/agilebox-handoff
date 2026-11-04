import { ValidationError } from '../shared/errors'
import type { BoardSettingsId, OrganizationId, UserId } from '../shared/ids'
import type { TaskStatus } from '../values/task-status'

/** Colunas que aceitam limite de WIP nesta fase (B4). As demais não aceitam. */
export const WIP_STATUSES = ['in_progress', 'review'] as const
export type WipStatus = (typeof WIP_STATUSES)[number]

export const WIP_LIMIT_MIN = 1
export const WIP_LIMIT_MAX = 99

/** Limite por coluna. Coluna ausente = sem limite. */
export type WipLimits = Partial<Record<TaskStatus, number>>

export function isWipStatus(value: string): value is WipStatus {
  return WIP_STATUSES.some((status) => status === value)
}

/**
 * Valida os limites: só colunas de WIP, inteiro de 1 a 99. Valor `undefined` conta como ausente.
 * Devolve uma cópia sem as chaves ausentes.
 */
export function validateWipLimits(limits: {
  readonly [K in TaskStatus]?: number | undefined
}): WipLimits {
  const result: Partial<Record<WipStatus, number>> = {}
  for (const [status, limit] of Object.entries(limits)) {
    if (limit === undefined) continue
    if (!isWipStatus(status))
      throw new ValidationError('Só as colunas Desenvolvendo e Revisar aceitam limite de WIP')
    if (!Number.isInteger(limit) || limit < WIP_LIMIT_MIN || limit > WIP_LIMIT_MAX)
      throw new ValidationError('Limite de WIP deve ser um número inteiro de 1 a 99')
    result[status] = limit
  }
  return result
}

/**
 * Configuração do quadro por organização. Não existe registro para a organização enquanto
 * ninguém define limites; nesse caso valem os limites vazios (sem limite em nenhuma coluna).
 */
export interface BoardSettings {
  readonly id: BoardSettingsId
  readonly organizationId: OrganizationId
  readonly wipLimits: WipLimits
  readonly updatedAt: string
  readonly updatedBy: UserId
}

export function createBoardSettings(input: BoardSettings): BoardSettings {
  return { ...input, wipLimits: validateWipLimits(input.wipLimits) }
}
