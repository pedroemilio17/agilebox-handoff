import { moduleStateOf } from '@agilebox/core'
import type { OrganizationId, Sprint, TaskId } from '@agilebox/core'
import type { SprintRefDto } from '@agilebox/contract'
import { toSprintRefDto } from '../../mappers'
import type { AppDeps } from '../../deps'

/**
 * Sprint aberta de cada tarefa pedida (M4.2), em lote: duas leituras no total, não uma por tarefa.
 * Sem o módulo `sprints` (desligado), nenhuma tarefa tem sprint. Com ele em encerramento, a sprint
 * ainda aparece, porque o que já existe segue visível até terminar. Sprint encerrada não conta.
 */
export async function loadSprintRefs(
  deps: Pick<AppDeps, 'teamTools' | 'sprints' | 'sprintTasks'>,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<ReadonlyMap<TaskId, SprintRefDto>> {
  const refs = new Map<TaskId, SprintRefDto>()
  if (taskIds.length === 0) return refs
  const settings = await deps.teamTools.getSettings(organizationId)
  if (moduleStateOf(settings.modules, 'sprints') === 'disabled') return refs

  const rows = await deps.sprintTasks.listOpenByTasks(organizationId, taskIds)
  const sprints = new Map<string, Sprint>()
  for (const sprintId of new Set(rows.map((row) => row.sprintId))) {
    const sprint = await deps.sprints.findById(organizationId, sprintId)
    if (sprint && sprint.status !== 'closed') sprints.set(sprintId, sprint)
  }
  for (const row of rows) {
    const sprint = sprints.get(row.sprintId)
    if (sprint) refs.set(row.taskId, toSprintRefDto(sprint))
  }
  return refs
}
