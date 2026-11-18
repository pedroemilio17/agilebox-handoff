import type { OrganizationId, ProjectId, TaskDependency, TaskId } from '@agilebox/core'

/**
 * Dependências término→início (ADR-10, cronograma). Toda leitura e escrita recebe a organização; tarefa
 * de outra organização é recusada com VALIDAÇÃO na gravação. Ciclo, duplicata de projeto e a própria
 * tarefa são validados antes, no domínio (`rules/schedule.ts`).
 */
export interface TaskDependencyRepository {
  /** Dependências cuja sucessora é tarefa do projeto (junta pelas tarefas do projeto). */
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<readonly TaskDependency[]>
  /** Dependências em que a tarefa é predecessora ou sucessora. */
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly TaskDependency[]>
  /** Grava uma dependência nova. Duplicata recusa com CONFLITO, sem gravar nada. */
  add(organizationId: OrganizationId, dependency: TaskDependency): Promise<void>
  /** Apaga a dependência da organização. Inexistente não faz nada. */
  remove(organizationId: OrganizationId, predecessorId: TaskId, successorId: TaskId): Promise<void>
}
