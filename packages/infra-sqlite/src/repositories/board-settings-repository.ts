import { and, eq } from 'drizzle-orm'
import type { BoardSettingsRepository } from '@agilebox/application'
import type { BoardSettings, OrganizationId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapBoardSettingsRow } from '../mappers/board-settings-mappers.js'
import { boardSettings, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteBoardSettingsRepository(
  database: SqliteDatabase,
): BoardSettingsRepository {
  return {
    async findByOrganization(organizationId: OrganizationId) {
      const [row] = await database
        .select()
        .from(boardSettings)
        .where(eq(boardSettings.organizationId, organizationId))
        .limit(1)
      return row ? mapBoardSettingsRow(row) : null
    },
    async save(organizationId: OrganizationId, settings: BoardSettings) {
      // Só grava configuração desta organização e com gestor desta organização.
      if (settings.organizationId !== organizationId) return
      const [author] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, settings.updatedBy), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!author) return
      const value = {
        id: settings.id,
        organizationId,
        wipLimits: JSON.stringify(settings.wipLimits),
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      }
      await database
        .insert(boardSettings)
        .values(value)
        .onConflictDoUpdate({
          target: boardSettings.id,
          set: {
            wipLimits: value.wipLimits,
            updatedAt: value.updatedAt,
            updatedBy: value.updatedBy,
          },
          where: eq(boardSettings.organizationId, organizationId),
        })
    },
  }
}
