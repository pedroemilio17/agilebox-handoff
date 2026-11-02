import type { AcceptanceCriterion, OrganizationId, TaskId } from '@agilebox/core'

/**
 * Critérios de aceite de uma tarefa, na ordem da lista (M3.9). A lista inteira é trocada de uma
 * vez: a posição de cada critério é a posição no array, e não há gravação parcial.
 */
export interface TaskCriteriaRepository {
  /** Critérios da tarefa na ordem da lista. Tarefa de outra organização devolve lista vazia. */
  listByTask(
    organizationId: OrganizationId,
    taskId: TaskId,
  ): Promise<readonly AcceptanceCriterion[]>
  /**
   * Troca a lista inteira de critérios da tarefa, de forma atômica. Tarefa de outra organização
   * é ignorada. Identificador repetido na lista, ou já usado por outra tarefa, recusa a troca
   * inteira e deixa a lista anterior como estava.
   */
  replaceForTask(
    organizationId: OrganizationId,
    taskId: TaskId,
    criteria: readonly AcceptanceCriterion[],
  ): Promise<void>
}
