import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { projects } from './projects.js'

/** Itens da definição de pronto de um projeto. Somem junto com o projeto (cascata). */
export const definitionOfDoneItems = sqliteTable(
  'definition_of_done_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    check('definition_of_done_items_title_check', sql`length(${table.title}) BETWEEN 1 AND 200`),
    check('definition_of_done_items_position_check', sql`${table.position} >= 0`),
    index('definition_of_done_items_project_position_index').on(table.projectId, table.position),
  ],
)
