import type {
  OrganizationId,
  ProjectId,
  Sprint,
  SprintId,
  SprintStatus,
  SprintTask,
  TaskId,
  UserId,
} from '@agilebox/core'

/**
 * Sprints do projeto (M4.2). Toda leitura recebe a organização. Sprint descartada (exclusão lógica,
 * decisão B) some das leituras, mas a linha continua no banco e o número nunca se reaproveita.
 */
export interface SprintRepository {
  /** Sprint não descartada da organização, pelo id. */
  findById(organizationId: OrganizationId, sprintId: SprintId): Promise<Sprint | null>
  /** Sprints do projeto que não foram descartadas, em ordem de número. */
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
    status?: SprintStatus,
  ): Promise<readonly Sprint[]>
  /** Próximo número do projeto: máximo + 1, contando também as descartadas. */
  nextNumber(organizationId: OrganizationId, projectId: ProjectId): Promise<number>
  /** Quantas sprints do projeto estão ativas (o limite de ADR-08 olha para isso). */
  countActive(organizationId: OrganizationId, projectId: ProjectId): Promise<number>
  /** Sprints da organização não encerradas e não descartadas (prévia de impacto). */
  countNotClosed(organizationId: OrganizationId): Promise<number>
  /** Grava a sprint (inclui o estado e o encerramento). Não mexe no descarte. */
  save(organizationId: OrganizationId, sprint: Sprint): Promise<void>
  /** Descarte lógico: a linha fica, marcada com quando e por quem. */
  markDiscarded(
    organizationId: OrganizationId,
    sprintId: SprintId,
    at: string,
    by: UserId,
  ): Promise<void>
}

/** Histórico de tarefas em sprints (`sprint_tasks`). Linhas nunca são apagadas. */
export interface SprintTaskRepository {
  /** Todas as linhas de uma sprint (histórico completo), na ordem de entrada. */
  listBySprint(organizationId: OrganizationId, sprintId: SprintId): Promise<readonly SprintTask[]>
  /** Linhas abertas (ainda na sprint) das tarefas pedidas. */
  listOpenByTasks(
    organizationId: OrganizationId,
    taskIds: readonly TaskId[],
  ): Promise<readonly SprintTask[]>
  /** Todas as linhas de uma tarefa, em qualquer sprint do projeto. */
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly SprintTask[]>
  /** Itens abertos em sprints não encerradas (prévia de impacto). */
  countOpenInNotClosed(organizationId: OrganizationId): Promise<number>
  /**
   * Grava linhas: insere as novas e atualiza as existentes (chave: sprint, tarefa e entrada). Recusa
   * com CONFLITO uma segunda linha aberta para a mesma tarefa.
   */
  saveRows(organizationId: OrganizationId, rows: readonly SprintTask[]): Promise<void>
}
