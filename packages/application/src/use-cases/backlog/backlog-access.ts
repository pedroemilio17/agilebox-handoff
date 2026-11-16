import { ConflictError, NotFoundError, PermissionDeniedError } from '@agilebox/core'
import type { Actor, Project, Task } from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Regra de acesso ao backlog de um projeto (membro ou gestor), vinda do domínio. */
export type BacklogPolicy = (actor: Actor, project: Project, isMember: boolean) => boolean

/**
 * Garante que o ator pode mexer no backlog do projeto da tarefa. Quem não é membro nem gestor
 * recebe sem permissão; tarefa arquivada só muda depois de desarquivada (mesma regra da edição).
 */
export async function assertBacklogAccess(
  deps: Pick<AppDeps, 'projects'>,
  actor: Actor,
  task: Task,
  allowed: BacklogPolicy,
): Promise<void> {
  const project = await deps.projects.findById(actor.organizationId, task.projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  const members = await deps.projects.listMembers(actor.organizationId, task.projectId)
  const isMember = members.some((member) => member.userId === actor.userId)
  if (!allowed(actor, project, isMember))
    throw new PermissionDeniedError('Sem permissão para mexer no backlog deste projeto')
  if (task.archivedAt !== null)
    throw new ConflictError('Tarefa arquivada não pode ser alterada. Desarquive para alterar.')
}
