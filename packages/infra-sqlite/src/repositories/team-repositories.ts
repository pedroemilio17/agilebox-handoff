import { eq } from 'drizzle-orm'
import { MODULE_IDS } from '@agilebox/core'
import type { OrganizationId } from '@agilebox/core'
import type {
  TeamModule,
  TeamModuleRepository,
  TeamSettings,
  TeamSettingsRepository,
} from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapTeamModuleRow, mapTeamSettingsRow } from '../mappers/team-mappers.js'
import { teamModules, teamSettings } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteTeamRepositories(database: SqliteDatabase): {
  readonly teamModules: TeamModuleRepository
  readonly teamSettings: TeamSettingsRepository
} {
  const teamModuleRepository: TeamModuleRepository = {
    async list(organizationId: OrganizationId) {
      const rows = await database
        .select()
        .from(teamModules)
        .where(eq(teamModules.organizationId, organizationId))
      return rows
        .map(mapTeamModuleRow)
        .sort((a, b) => MODULE_IDS.indexOf(a.moduleId) - MODULE_IDS.indexOf(b.moduleId))
    },
    async save(organizationId: OrganizationId, teamModule: TeamModule) {
      const value = { ...teamModule, organizationId }
      await database
        .insert(teamModules)
        .values(value)
        .onConflictDoUpdate({
          target: [teamModules.organizationId, teamModules.moduleId],
          set: {
            state: value.state,
            config: value.config,
            changedBy: value.changedBy,
            changedAt: value.changedAt,
          },
        })
    },
  }

  const teamSettingsRepository: TeamSettingsRepository = {
    async find(organizationId: OrganizationId) {
      const [row] = await database
        .select()
        .from(teamSettings)
        .where(eq(teamSettings.organizationId, organizationId))
        .limit(1)
      return row ? mapTeamSettingsRow(row) : null
    },
    async save(organizationId: OrganizationId, settings: TeamSettings) {
      const value = { ...settings, organizationId }
      await database
        .insert(teamSettings)
        .values(value)
        .onConflictDoUpdate({
          target: teamSettings.organizationId,
          set: { level: value.level, changedBy: value.changedBy, changedAt: value.changedAt },
        })
    },
  }

  return { teamModules: teamModuleRepository, teamSettings: teamSettingsRepository }
}
