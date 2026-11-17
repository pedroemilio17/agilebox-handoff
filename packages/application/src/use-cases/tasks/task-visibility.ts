import { isHiddenByArchive, showsOnBoard } from '@agilebox/core'
import type { OrganizationId, Project, ProjectId, Task } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Projetos arquivados (ids). As tarefas deles saem das visões padrão. */
export function archivedProjectIds(projects: readonly Project[]): ReadonlySet<ProjectId> {
  return new Set(
    projects.filter((project) => project.archivedAt !== null).map((project) => project.id),
  )
}

export interface TaskVisibilityOptions {
  /** Inclui arquivadas e as de projeto arquivado. Padrão: ocultas. */
  readonly includeArchived?: boolean
  /**
   * Inclui itens de backlog. Padrão: ocultos, porque item de backlog não aparece no quadro,
   * nas listas da bandeja, na busca, no dashboard nem na agenda. Só as consultas do backlog o pedem.
   */
  readonly includeBacklog?: boolean
}

/**
 * Ponto único de visibilidade das visões de tarefa (quadro, equipe, recentes, frequentes, busca,
 * dashboard e WIP). Esconde arquivadas e de projeto arquivado, e os itens de backlog.
 */
export function filterVisibleTasks(
  tasks: readonly Task[],
  archivedProjects: ReadonlySet<ProjectId>,
  options: TaskVisibilityOptions = {},
): Task[] {
  return tasks.filter((task) => {
    if (!options.includeBacklog && !showsOnBoard(task)) return false
    if (options.includeArchived) return true
    return !isHiddenByArchive(task, archivedProjects.has(task.projectId))
  })
}

/** Versão para casos de uso que ainda não carregaram os projetos da organização. */
export async function visibleTasks(
  deps: Pick<AppDeps, 'projects'>,
  organizationId: OrganizationId,
  tasks: readonly Task[],
  options: TaskVisibilityOptions = {},
): Promise<Task[]> {
  if (tasks.length === 0) return []
  const archived = options.includeArchived
    ? new Set<ProjectId>()
    : archivedProjectIds(await deps.projects.list(organizationId))
  return filterVisibleTasks(tasks, archived, options)
}
