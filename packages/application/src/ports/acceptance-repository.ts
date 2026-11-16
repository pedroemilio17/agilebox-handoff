import type {
  AcceptanceCriterion,
  AcceptanceCriterionId,
  OrganizationId,
  TaskId,
} from '@agilebox/core'

export interface AcceptanceRepository {
  /** Critérios da tarefa, em ordem de posição. */
  listByTask(
    organizationId: OrganizationId,
    taskId: TaskId,
  ): Promise<readonly AcceptanceCriterion[]>
  /** Critérios de várias tarefas de uma vez, em ordem de posição dentro de cada tarefa. */
  listByTasks(
    organizationId: OrganizationId,
    taskIds: readonly TaskId[],
  ): Promise<readonly AcceptanceCriterion[]>
  /** Grava (insere ou atualiza) os critérios. Ignora critérios de tarefas de outra organização. */
  saveMany(organizationId: OrganizationId, criteria: readonly AcceptanceCriterion[]): Promise<void>
  remove(organizationId: OrganizationId, criterionId: AcceptanceCriterionId): Promise<void>
  /** Critérios das tarefas não arquivadas da organização (contagem da prévia de impacto). */
  countByOrganization(organizationId: OrganizationId): Promise<number>
}
