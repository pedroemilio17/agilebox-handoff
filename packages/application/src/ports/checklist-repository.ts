import type { ChecklistItem, ChecklistItemId, OrganizationId, TaskId } from '@agilebox/core'

export interface ChecklistRepository {
  /** Itens da tarefa, em ordem de posição. */
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly ChecklistItem[]>
  /** Itens de várias tarefas (para o progresso do quadro), sem ordem garantida entre tarefas. */
  listByTasks(
    organizationId: OrganizationId,
    taskIds: readonly TaskId[],
  ): Promise<readonly ChecklistItem[]>
  /** Grava (insere ou atualiza) os itens. Ignora itens de tarefas de outra organização. */
  saveMany(organizationId: OrganizationId, items: readonly ChecklistItem[]): Promise<void>
  remove(organizationId: OrganizationId, itemId: ChecklistItemId): Promise<void>
}
