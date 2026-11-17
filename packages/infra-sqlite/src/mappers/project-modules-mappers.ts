import { toModuleId, toModuleState, toTeamModuleConfig, toUserId } from '@agilebox/core'
import type { ProjectModuleSetting } from '@agilebox/application'
import type { projectModules } from '../schema/index.js'

type ProjectModuleRow = typeof projectModules.$inferSelect

/** `config` é JSON de objeto simples; valor fora do formato é erro de dados, não é ignorado. */
export function mapProjectModuleRow(row: ProjectModuleRow): ProjectModuleSetting {
  return {
    moduleId: toModuleId(row.moduleId),
    state: toModuleState(row.state),
    config: row.config === null ? null : toTeamModuleConfig(JSON.parse(row.config)),
    changedBy: row.changedBy === null ? null : toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}
