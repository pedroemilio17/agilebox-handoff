import { wipStatus } from '@agilebox/core'
import type { TaskDto, WipColumnDto, WipLimitsDto } from '@agilebox/contract'
import { WIP_STATUSES } from './wip-limit'

/**
 * Medidor de WIP da visão Equipe: conta só as tarefas exibidas (a Equipe não tem a contagem do
 * servidor do quadro pessoal). O limite é o da organização, que vem do quadro.
 */
export function teamWipColumns(
  tasks: readonly Pick<TaskDto, 'status'>[],
  wipLimits: WipLimitsDto = {},
): WipColumnDto[] {
  return WIP_STATUSES.map((status) => {
    const count = tasks.filter((task) => task.status === status).length
    const limit = wipLimits[status]
    return { status, count, limit: limit ?? null, state: wipStatus(count, limit) }
  })
}
