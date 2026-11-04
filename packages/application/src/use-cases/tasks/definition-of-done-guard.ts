import {
  assertDefinitionOfDoneConfirmed,
  definitionConfirmedDraft,
  entersDone,
} from '@agilebox/core'
import type { OrganizationId, ProjectId, TaskStatus, TimelineEventDraft } from '@agilebox/core'
import type { DefinitionOfDoneRepository } from '../../ports'

/**
 * Conferência ao concluir (qualquer caminho que leve a Concluído). Se o projeto tem itens de
 * definição de pronto, todos os itens atuais precisam vir confirmados. Devolve o evento de
 * confirmação; projeto sem itens não gera evento nem exige nada.
 */
export async function definitionOfDoneCompletion(
  repository: DefinitionOfDoneRepository,
  organizationId: OrganizationId,
  projectId: ProjectId,
  from: TaskStatus,
  to: TaskStatus,
  confirmedIds: readonly string[],
): Promise<TimelineEventDraft[]> {
  if (!entersDone(from, to)) return []
  const items = await repository.listByProject(organizationId, projectId)
  assertDefinitionOfDoneConfirmed(items, confirmedIds)
  return items.length === 0 ? [] : [definitionConfirmedDraft(items.length)]
}
