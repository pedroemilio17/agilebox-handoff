import { canSeeComments } from '@agilebox/core'
import type { Actor, OrganizationId, Task, TaskId, UserId } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/**
 * Quantidade de comentários de cada tarefa, só para quem vê os comentários (participante ou gestor).
 * Para os demais a contagem é 0, para não revelar a existência de comentários.
 */
export async function loadCommentCounts(
  deps: AppDeps,
  actor: Actor,
  tasks: readonly Task[],
): Promise<ReadonlyMap<TaskId, number>> {
  const counts = new Map<TaskId, number>(tasks.map((task) => [task.id, 0]))
  const visible = tasks.filter((task) => canSeeComments(actor, task)).map((task) => task.id)
  if (visible.length === 0) return counts
  for (const row of await deps.comments.countByTasks(actor.organizationId, visible)) {
    counts.set(row.taskId, row.count)
  }
  return counts
}

/** Nomes de todos os usuários da organização (autores e mencionados podem ter saído da tarefa). */
export async function loadUserNames(
  deps: AppDeps,
  organizationId: OrganizationId,
): Promise<{ readonly user: (id: UserId) => string }> {
  const users = await deps.users.list(organizationId)
  const names = new Map<UserId, string>(users.map((user) => [user.id, user.name]))
  return { user: (id) => names.get(id) ?? 'Usuário' }
}
