import type { OrganizationId, TaskComment, TaskCommentId, TaskId } from '@agilebox/core'

export interface TaskCommentRepository {
  /** Comentários da tarefa, do mais antigo para o mais novo. */
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly TaskComment[]>
  /** Quantidade de comentários por tarefa (só as tarefas com comentário aparecem). */
  countByTasks(
    organizationId: OrganizationId,
    taskIds: readonly TaskId[],
  ): Promise<readonly { readonly taskId: TaskId; readonly count: number }[]>
  findById(organizationId: OrganizationId, commentId: TaskCommentId): Promise<TaskComment | null>
  /** Grava (insere ou atualiza corpo, menções e edição). Ignora comentário de outra organização. */
  save(organizationId: OrganizationId, comment: TaskComment): Promise<void>
  remove(organizationId: OrganizationId, commentId: TaskCommentId): Promise<void>
}
