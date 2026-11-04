import type { BoardSettings, OrganizationId } from '@agilebox/core'

export interface BoardSettingsRepository {
  /** Configuração da organização, ou null enquanto ninguém definiu limites (sem limites). */
  findByOrganization(organizationId: OrganizationId): Promise<BoardSettings | null>
  /** Grava a configuração (uma por organização). Ignora registro de outra organização. */
  save(organizationId: OrganizationId, settings: BoardSettings): Promise<void>
}
