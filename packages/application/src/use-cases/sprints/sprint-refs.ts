import { moduleStateOf } from '@agilebox/core'
import type { OrganizationId, ProjectId, Sprint, TaskId } from '@agilebox/core'
import type { SprintRefDto } from '@agilebox/contract'
import { toSprintRefDto } from '../../mappers'
import type { AppDeps } from '../../deps'

/**
 * Sprint aberta de cada tarefa pedida (M4.2), em lote: duas leituras no total, não uma por tarefa.
 * Sem o módulo `sprints` no projeto da sprint (desligado), a tarefa não mostra essa sprint (ADR-10:
 * o estado é do projeto). Com ele em encerramento, a sprint ainda aparece, porque o que já existe
 * segue visível até terminar. Sprint encerrada não conta.
 */
export async function loadSprintRefs(
  deps: Pick<AppDeps, 'projectModules' | 'sprints' | 'sprintTasks'>,
  organizationId: OrganizationId,
  taskIds: readonly TaskId[],
): Promise<ReadonlyMap<TaskId, SprintRefDto>> {
  const refs = new Map<TaskId, SprintRefDto>()
  if (taskIds.length === 0) return refs

  const rows = await deps.sprintTasks.listOpenByTasks(organizationId, taskIds)
  const sprints = new Map<string, Sprint>()
  const visibleByProject = new Map<ProjectId, boolean>()
  for (const sprintId of new Set(rows.map((row) => row.sprintId))) {
    const sprint = await deps.sprints.findById(organizationId, sprintId)
    if (!sprint || sprint.status === 'closed') continue
    if (!visibleByProject.has(sprint.projectId)) {
      const rowsOfProject = await deps.projectModules.list(organizationId, sprint.projectId)
      visibleByProject.set(sprint.projectId, moduleStateOf(rowsOfProject, 'sprints') !== 'disabled')
    }
    if (visibleByProject.get(sprint.projectId) === true) sprints.set(sprintId, sprint)
  }
  for (const row of rows) {
    const sprint = sprints.get(row.sprintId)
    if (sprint) refs.set(row.taskId, toSprintRefDto(sprint))
  }
  return refs
}
