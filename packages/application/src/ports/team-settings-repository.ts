import type { ExperienceLevel, OrganizationId, UserId } from '@agilebox/core'

/** Preferências do time (um registro por time). */
export interface TeamSettings {
  readonly level: ExperienceLevel
  readonly changedBy: UserId
  readonly changedAt: string
}

export interface TeamSettingsRepository {
  /** Devolve null enquanto o time não tiver preferências gravadas. */
  find(organizationId: OrganizationId): Promise<TeamSettings | null>
  /** Grava ou substitui as preferências do time. */
  save(organizationId: OrganizationId, settings: TeamSettings): Promise<void>
}
