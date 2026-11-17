import {
  canEditProjectStructure,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  Deliverable,
  DeliverableId,
  OrganizationId,
  Project,
  ProjectId,
} from '@agilebox/core'
import type { AppDeps } from '../../deps'

/** Mensagens da estrutura (EAP e marcos). Ficam aqui para os dois módulos falarem igual. */
export const STRUCTURE_DENIED = 'Sem permissão para editar a EAP e os marcos deste projeto'
export const STRUCTURE_ARCHIVED =
  'Projeto arquivado não aceita mudanças na EAP ou nos marcos. Desarquive o projeto para editar.'

/**
 * Projeto de uma alteração estrutural (entrega ou marco): existe, o ator é gestor ou criador, e o
 * projeto não está arquivado. Nessa ordem, para que a recusa de permissão não revele o estado.
 */
export async function structureProject(
  deps: Pick<AppDeps, 'projects'>,
  actor: Actor,
  projectId: ProjectId,
): Promise<Project> {
  const project = await deps.projects.findById(actor.organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  if (!canEditProjectStructure(actor, project)) throw new PermissionDeniedError(STRUCTURE_DENIED)
  if (project.archivedAt !== null) throw new ConflictError(STRUCTURE_ARCHIVED)
  return project
}

export async function deliverableOf(
  deps: Pick<AppDeps, 'deliverables'>,
  organizationId: OrganizationId,
  deliverableId: DeliverableId,
): Promise<Deliverable> {
  const deliverable = await deps.deliverables.findById(organizationId, deliverableId)
  if (!deliverable) throw new NotFoundError('Entrega não encontrada')
  return deliverable
}

/**
 * Entrega de destino de uma ligação (pai de entrega, entrega de tarefa ou de marco): precisa existir
 * na organização e ser do mesmo projeto. Entrega de outro projeto recebe VALIDAÇÃO com a mensagem.
 */
export async function linkedDeliverable(
  deps: Pick<AppDeps, 'deliverables'>,
  organizationId: OrganizationId,
  projectId: ProjectId,
  deliverableId: DeliverableId,
  otherProjectMessage: string,
): Promise<Deliverable> {
  const deliverable = await deliverableOf(deps, organizationId, deliverableId)
  if (deliverable.projectId !== projectId) throw new ValidationError(otherProjectMessage)
  return deliverable
}
