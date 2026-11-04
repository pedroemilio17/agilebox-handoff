import { and, asc, eq } from 'drizzle-orm'
import type { DefinitionOfDoneRepository } from '@agilebox/application'
import type {
  DefinitionOfDoneItem,
  DefinitionOfDoneItemId,
  OrganizationId,
  ProjectId,
} from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapDefinitionOfDoneRow } from '../mappers/definition-of-done-mappers.js'
import { definitionOfDoneItems, projects } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteDefinitionOfDoneRepository(
  database: SqliteDatabase,
): DefinitionOfDoneRepository {
  return {
    async listByProject(organizationId: OrganizationId, projectId: ProjectId) {
      const rows = await database
        .select()
        .from(definitionOfDoneItems)
        .where(
          and(
            eq(definitionOfDoneItems.organizationId, organizationId),
            eq(definitionOfDoneItems.projectId, projectId),
          ),
        )
        .orderBy(asc(definitionOfDoneItems.position))
      return rows.map(mapDefinitionOfDoneRow)
    },
    async listByOrganization(organizationId: OrganizationId) {
      const rows = await database
        .select()
        .from(definitionOfDoneItems)
        .where(eq(definitionOfDoneItems.organizationId, organizationId))
        .orderBy(asc(definitionOfDoneItems.projectId), asc(definitionOfDoneItems.position))
      return rows.map(mapDefinitionOfDoneRow)
    },
    async saveMany(organizationId: OrganizationId, items: readonly DefinitionOfDoneItem[]) {
      for (const item of items) {
        // Só grava item de projeto desta organização.
        const [project] = await database
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, item.projectId), eq(projects.organizationId, organizationId)))
          .limit(1)
        if (!project || item.organizationId !== organizationId) continue
        const value = {
          id: item.id,
          organizationId,
          projectId: item.projectId,
          title: item.title,
          position: item.position,
        }
        await database
          .insert(definitionOfDoneItems)
          .values(value)
          .onConflictDoUpdate({
            target: definitionOfDoneItems.id,
            set: { title: value.title, position: value.position },
            where: eq(definitionOfDoneItems.organizationId, organizationId),
          })
      }
    },
    async remove(organizationId: OrganizationId, itemId: DefinitionOfDoneItemId) {
      await database
        .delete(definitionOfDoneItems)
        .where(
          and(
            eq(definitionOfDoneItems.id, itemId),
            eq(definitionOfDoneItems.organizationId, organizationId),
          ),
        )
    },
  }
}
