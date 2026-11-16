import type { AcceptanceCriterion, OrganizationId, TaskId } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Critérios de aceitação de cada tarefa pedida (lista vazia para tarefas sem critérios). */
export async function loadCriteria(
  deps: Pick<AppDeps, 'acceptance'>,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<ReadonlyMap<TaskId, readonly AcceptanceCriterion[]>> {
  const grouped = new Map<TaskId, AcceptanceCriterion[]>(taskIds.map((id) => [id, []]))
  if (taskIds.length === 0) return grouped
  for (const criterion of await deps.acceptance.listByTasks(organizationId, taskIds))
    grouped.get(criterion.taskId)?.push(criterion)
  return grouped
}
