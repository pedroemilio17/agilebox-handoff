import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'

/** Critérios de aceitação de uma tarefa (M3.2). Posições contíguas de 0 a n-1, até 20 por tarefa. */
export const taskAcceptanceCriteria = sqliteTable(
  'task_acceptance_criteria',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('task_acceptance_criteria_text_check', sql`length(${table.text}) BETWEEN 1 AND 200`),
    check('task_acceptance_criteria_position_check', sql`${table.position} >= 0`),
    index('task_acceptance_criteria_task_position_index').on(table.taskId, table.position),
    index('task_acceptance_criteria_organization_task_index').on(
      table.organizationId,
      table.taskId,
    ),
  ],
)
