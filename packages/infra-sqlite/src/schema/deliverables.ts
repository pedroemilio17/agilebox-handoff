import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Entregas da EAP (ADR-10): a mesma entidade do épico. Profundidade (máximo de 3 níveis) e ciclos
 * são validados no domínio; o código "1.2" não é gravado. `position` ordena os irmãos.
 */
export const deliverables = sqliteTable(
  'deliverables',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    parentId: text('parent_id').references((): AnySQLiteColumn => deliverables.id),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('deliverables_position_check', sql`${table.position} >= 0`),
    index('deliverables_organization_project_parent_position_index').on(
      table.organizationId,
      table.projectId,
      table.parentId,
      table.position,
    ),
  ],
)
