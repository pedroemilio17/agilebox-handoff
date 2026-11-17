import type {
  OrganizationId,
  TeamToolsAuditEntry,
  TeamToolsSettings,
  TeamToolsUpdate,
  UserId,
} from '@agilebox/core'

/**
 * Ferramentas e nível da equipe. Toda leitura e gravação recebe a organização e só toca nos dados
 * dela. Sem nenhuma linha gravada, a leitura devolve o padrão de `defaultTeamTools`.
 */
export interface TeamToolsRepository {
  /** Nível e ferramentas da organização. Sem preferência gravada, devolve o padrão de código. */
  getSettings(organizationId: OrganizationId): Promise<TeamToolsSettings>
  /**
   * Grava nível e ferramentas de forma atômica e acrescenta a auditoria das diferenças (estado
   * de ferramenta e nível). Conjunto inválido é recusado antes de qualquer escrita. Ator que não
   * pertence à organização é recusado com `ValidationError`, sem gravar nada.
   */
  saveSettings(
    organizationId: OrganizationId,
    update: TeamToolsUpdate,
    actorId: UserId,
    at: string,
  ): Promise<void>
  /** Auditoria da organização, da mais recente para a mais antiga. */
  listAudit(organizationId: OrganizationId, limit: number): Promise<readonly TeamToolsAuditEntry[]>
}
