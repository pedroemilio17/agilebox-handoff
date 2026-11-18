import type { ProjectModuleEvent } from '@agilebox/application'
import {
  toModuleId,
  toOrganizationId,
  toProjectId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { projectModuleEvents } from '../schema/index.js'

type ProjectModuleEventRow = typeof projectModuleEvents.$inferSelect

const ACTIONS = ['enabled', 'disabled', 'winding_down', 'scheduled_disable', 'cancelled'] as const

/** Ação e papel gravados são conferidos ao sair do banco: valor fora do conjunto é erro de dados. */
export function mapProjectModuleEventRow(row: ProjectModuleEventRow): ProjectModuleEvent {
  if (!(ACTIONS as readonly string[]).includes(row.action))
    throw new ValidationError('Ação de histórico inválida')
  if (row.actorRole !== 'collaborator' && row.actorRole !== 'manager')
    throw new ValidationError('Papel de histórico inválido')
  return {
    id: row.id,
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    moduleId: toModuleId(row.moduleId),
    action: row.action as ProjectModuleEvent['action'],
    actorId: toUserId(row.actorId),
    actorRole: row.actorRole,
    auto: row.auto,
    relatedModuleId: row.relatedModuleId === null ? null : toModuleId(row.relatedModuleId),
    at: row.at,
  }
}
