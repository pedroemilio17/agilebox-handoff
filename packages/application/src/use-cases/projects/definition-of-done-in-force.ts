import { moduleStateOf } from '@agilebox/core'
import type { DefinitionOfDoneItem, OrganizationId, ProjectId } from '@agilebox/core'
import type { DefinitionOfDoneRepository, ProjectModulesRepository } from '../../ports'

/** Repositórios que dizem se a definição de pronto vale no projeto e quais são os itens. */
export interface DefinitionOfDoneScope {
  readonly definitionOfDone: DefinitionOfDoneRepository
  readonly projectModules: ProjectModulesRepository
}

/**
 * Itens da definição de pronto que valem no projeto (ADR-10, módulo `definitionOfDone`).
 * Com o módulo desligado, a regra não vale: não há itens em vigor, então a conclusão não exige
 * nada e a contagem do projeto e a lista da tarefa voltam vazias. Os itens continuam no banco
 * (desligar oculta, nunca apaga). `winding_down` segue valendo, como o que já existe nos outros
 * módulos. Projeto sem linhas de módulo conta como desligado (`moduleStateOf`).
 */
export async function definitionItemsInForce(
  scope: DefinitionOfDoneScope,
  organizationId: OrganizationId,
  projectId: ProjectId,
): Promise<readonly DefinitionOfDoneItem[]> {
  const rows = await scope.projectModules.list(organizationId, projectId)
  if (moduleStateOf(rows, 'definitionOfDone') === 'disabled') return []
  return scope.definitionOfDone.listByProject(organizationId, projectId)
}
