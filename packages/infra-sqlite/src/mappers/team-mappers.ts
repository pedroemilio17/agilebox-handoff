import { isExperienceLevel, SUGGESTED_LEVEL, toUserId } from '@agilebox/core'
import type { ModuleId, ModuleState } from '@agilebox/core'
import type { TeamModule, TeamModuleEvent, TeamSettings } from '@agilebox/application'
import type { teamModuleEvents, teamModules, teamSettings } from '../schema/index.js'

type TeamModuleRow = typeof teamModules.$inferSelect
type TeamModuleEventRow = typeof teamModuleEvents.$inferSelect
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

export function mapTeamModuleEventRow(row: TeamModuleEventRow): TeamModuleEvent {
  return {
    id: row.id,
    moduleId: row.moduleId as ModuleId,
    fromState: row.fromState as ModuleState,
    toState: row.toState as ModuleState,
    changedBy: toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}

/** Nível fora do catálogo no banco cai no sugerido, para a tela de Ajustes continuar abrindo. */
export function mapTeamSettingsRow(row: TeamSettingsRow): TeamSettings {
  return {
    level: isExperienceLevel(row.level) ? row.level : SUGGESTED_LEVEL,
    changedBy: toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}
