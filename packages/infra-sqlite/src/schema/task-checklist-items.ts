import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'

export const taskChecklistItems = sqliteTable(
  'task_checklist_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    doneAt: text('done_at'),
  },
  (table) => [
    check('task_checklist_items_title_check', sql`length(${table.title}) BETWEEN 1 AND 200`),
    check('task_checklist_items_position_check', sql`${table.position} >= 0`),
    index('task_checklist_items_task_position_index').on(table.taskId, table.position),
  ],
)
