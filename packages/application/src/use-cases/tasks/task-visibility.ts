import { isHiddenByArchive } from '@agilebox/core'
import type { OrganizationId, Project, ProjectId, Task } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Projetos arquivados (ids). As tarefas deles saem das visões padrão. */
export function archivedProjectIds(projects: readonly Project[]): ReadonlySet<ProjectId> {
  return new Set(
    projects.filter((project) => project.archivedAt !== null).map((project) => project.id),
  )
}

/** Esconde tarefas arquivadas e de projeto arquivado. `includeArchived` mostra tudo. */
export function filterVisibleTasks(
  tasks: readonly Task[],
  archivedProjects: ReadonlySet<ProjectId>,
  includeArchived = false,
): Task[] {
  if (includeArchived) return [...tasks]
  return tasks.filter((task) => !isHiddenByArchive(task, archivedProjects.has(task.projectId)))
}

/** Versão para casos de uso que ainda não carregaram os projetos da organização. */
export async function visibleTasks(
  deps: Pick<AppDeps, 'projects'>,
  organizationId: OrganizationId,
  tasks: readonly Task[],
  includeArchived = false,
): Promise<Task[]> {
  if (includeArchived || tasks.length === 0) return [...tasks]
  const archived = archivedProjectIds(await deps.projects.list(organizationId))
  return filterVisibleTasks(tasks, archived)
}
