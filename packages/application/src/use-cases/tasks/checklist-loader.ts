import type { ChecklistItem, TaskId } from '@agilebox/core'
import type { OrganizationId } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Subtarefas de cada tarefa pedida (lista vazia para tarefas sem itens). */
export async function loadChecklists(
  deps: AppDeps,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<ReadonlyMap<TaskId, readonly ChecklistItem[]>> {
  const grouped = new Map<TaskId, ChecklistItem[]>(taskIds.map((id) => [id, []]))
  if (taskIds.length === 0) return grouped
  const items = await deps.checklist.listByTasks(organizationId, taskIds)
  for (const item of items) grouped.get(item.taskId)?.push(item)
  for (const list of grouped.values()) list.sort((a, b) => a.position - b.position)
  return grouped
}
