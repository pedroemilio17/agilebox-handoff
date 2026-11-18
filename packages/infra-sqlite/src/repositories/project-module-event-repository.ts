import { and, desc, eq } from 'drizzle-orm'
import type { NewProjectModuleEvent, ProjectModuleEventRepository } from '@agilebox/application'
import { ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapProjectModuleEventRow } from '../mappers/project-module-event-mappers.js'
import { projectModuleEvents } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Histórico de módulos por projeto em SQLite. Toda consulta filtra por `organization_id`. A
 * gravação é um único INSERT em lote: quem chama já está dentro da unidade de trabalho.
 */
export function createSqliteProjectModuleEventRepository(
  database: SqliteDatabase,
): ProjectModuleEventRepository {
  return {
    async append(organizationId: OrganizationId, events: readonly NewProjectModuleEvent[]) {
      if (events.length === 0) return
      await database.insert(projectModuleEvents).values(
        events.map((event) => {
          if (event.organizationId !== organizationId)
            throw new ValidationError('Evento de outra organização não pode ser gravado aqui')
          return {
            organizationId,
            projectId: event.projectId,
            moduleId: event.moduleId,
            action: event.action,
            actorId: event.actorId,
            actorRole: event.actorRole,
            auto: event.auto,
            relatedModuleId: event.relatedModuleId,
            at: event.at,
          }
        }),
      )
    },

    async listByProject(organizationId: OrganizationId, projectId: ProjectId, limit: number) {
      if (!Number.isInteger(limit) || limit < 1)
        throw new ValidationError('Limite do histórico inválido')
      const rows = await database
        .select()
        .from(projectModuleEvents)
        .where(
          and(
            eq(projectModuleEvents.organizationId, organizationId),
            eq(projectModuleEvents.projectId, projectId),
          ),
        )
        .orderBy(desc(projectModuleEvents.at), desc(projectModuleEvents.id))
        .limit(limit)
      return rows.map(mapProjectModuleEventRow)
    },
  }
}
