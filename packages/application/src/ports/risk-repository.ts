import type { OrganizationId, ProjectId, Risk, RiskId } from '@agilebox/core'

/**
 * Riscos do projeto (ADR-10, módulo `risks`). Mesma regra de organização e de vínculo das entregas:
 * projeto, criador, dono e entrega de outra organização (ou de outro projeto) são recusados com
 * VALIDAÇÃO, e id de outra organização não é regravado.
 */
export interface RiskRepository {
  /** Riscos do projeto, na ordem de criação. A ordenação por pontuação é regra do domínio. */
  listByProject(organizationId: OrganizationId, projectId: ProjectId): Promise<readonly Risk[]>
  findById(organizationId: OrganizationId, riskId: RiskId): Promise<Risk | null>
  /** Insere ou atualiza. */
  save(organizationId: OrganizationId, risk: Risk): Promise<void>
  delete(organizationId: OrganizationId, riskId: RiskId): Promise<void>
}
