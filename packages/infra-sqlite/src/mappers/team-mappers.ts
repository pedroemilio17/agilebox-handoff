import { toUserId } from '@agilebox/core'
import type { ModuleId, ModuleState, ExperienceLevel } from '@agilebox/core'
import type { TeamModule, TeamSettings } from '@agilebox/application'
import type { teamModules, teamSettings } from '../schema/index.js'

type TeamModuleRow = typeof teamModules.$inferSelect
type TeamSettingsRow = typeof teamSettings.$inferSelect

export function mapTeamModuleRow(row: TeamModuleRow): TeamModule {
  return {
    moduleId: row.moduleId as ModuleId,
    state: row.state as ModuleState,
    config: row.config,
    changedBy: toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}

export function mapTeamSettingsRow(row: TeamSettingsRow): TeamSettings {
  return {
    level: row.level as ExperienceLevel,
    changedBy: toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}
