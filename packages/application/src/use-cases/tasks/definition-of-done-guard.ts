import {
  assertDefinitionOfDoneConfirmed,
  definitionConfirmedDraft,
  entersDone,
} from '@agilebox/core'
import type { OrganizationId, ProjectId, TaskStatus, TimelineEventDraft } from '@agilebox/core'
import { definitionItemsInForce } from '../projects/definition-of-done-in-force'
import type { DefinitionOfDoneScope } from '../projects/definition-of-done-in-force'

/**
 * Conferência ao concluir (qualquer caminho que leve a Concluído). Se o projeto tem itens de
 * definição de pronto em vigor (módulo `definitionOfDone` ligado, ADR-10), todos os itens atuais
 * precisam vir confirmados. Devolve o evento de confirmação; projeto sem itens em vigor não gera
 * evento nem exige nada. Com o módulo desligado, a regra some e os itens ficam guardados.
 */
export async function definitionOfDoneCompletion(
  scope: DefinitionOfDoneScope,
  organizationId: OrganizationId,
  projectId: ProjectId,
  from: TaskStatus,
  to: TaskStatus,
  confirmedIds: readonly string[],
): Promise<TimelineEventDraft[]> {
  if (!entersDone(from, to)) return []
  const items = await definitionItemsInForce(scope, organizationId, projectId)
  assertDefinitionOfDoneConfirmed(items, confirmedIds)
  return items.length === 0 ? [] : [definitionConfirmedDraft(items.length)]
}
