import {
  toModuleId,
  toModuleState,
  toOrganizationId,
  toTeamModuleConfig,
  toTeamToolsAuditKind,
  toUserId,
} from '@agilebox/core'
import type { TeamModuleSetting, TeamToolsAuditEntry } from '@agilebox/core'
import type { teamModules, teamToolsAudit } from '../schema/index.js'

type TeamModuleRow = typeof teamModules.$inferSelect
type TeamToolsAuditRow = typeof teamToolsAudit.$inferSelect

/** `config` é JSON de objeto simples; valor fora do formato é erro de dados, não é ignorado. */
export function mapTeamModuleRow(row: TeamModuleRow): TeamModuleSetting {
  return {
    organizationId: toOrganizationId(row.organizationId),
    moduleId: toModuleId(row.moduleId),
    state: toModuleState(row.state),
    ...(row.config !== null ? { config: toTeamModuleConfig(JSON.parse(row.config)) } : {}),
    changedBy: row.changedBy === null ? null : toUserId(row.changedBy),
    changedAt: row.changedAt,
  }
}

export function mapTeamToolsAuditRow(row: TeamToolsAuditRow): TeamToolsAuditEntry {
  return {
    id: row.id,
    organizationId: toOrganizationId(row.organizationId),
    actorId: toUserId(row.actorId),
    kind: toTeamToolsAuditKind(row.kind),
    moduleId: row.moduleId === null ? null : toModuleId(row.moduleId),
    before: row.before,
    after: row.after,
    createdAt: row.createdAt,
  }
}
