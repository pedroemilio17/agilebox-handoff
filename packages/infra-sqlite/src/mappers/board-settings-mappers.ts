import { createBoardSettings, toBoardSettingsId, toOrganizationId, toUserId } from '@agilebox/core'
import type { BoardSettings, WipLimits } from '@agilebox/core'
import type { boardSettings } from '../schema/index.js'

type BoardSettingsRow = typeof boardSettings.$inferSelect

/** Lê o JSON de limites; valor que não passa na validação do domínio vira erro (dado corrompido). */
export function mapBoardSettingsRow(row: BoardSettingsRow): BoardSettings {
  return createBoardSettings({
    id: toBoardSettingsId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    wipLimits: JSON.parse(row.wipLimits) as WipLimits,
    updatedAt: row.updatedAt,
    updatedBy: toUserId(row.updatedBy),
  })
}
