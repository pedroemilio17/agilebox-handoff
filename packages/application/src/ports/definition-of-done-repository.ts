import type {
  DefinitionOfDoneItem,
  DefinitionOfDoneItemId,
  OrganizationId,
  ProjectId,
} from '@agilebox/core'

export interface DefinitionOfDoneRepository {
  /** Itens do projeto, em ordem de posição. */
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<readonly DefinitionOfDoneItem[]>
  /** Itens de todos os projetos da organização (para a contagem na lista de projetos). */
  listByOrganization(organizationId: OrganizationId): Promise<readonly DefinitionOfDoneItem[]>
  /** Grava (insere ou atualiza). Ignora itens de projeto de outra organização. */
  saveMany(organizationId: OrganizationId, items: readonly DefinitionOfDoneItem[]): Promise<void>
  remove(organizationId: OrganizationId, itemId: DefinitionOfDoneItemId): Promise<void>
}
