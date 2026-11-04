import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const organizations = sqliteTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    taskPrefix: text('task_prefix').notNull().default('AB'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('organizations_task_prefix_check', sql`length(${table.taskPrefix}) BETWEEN 2 AND 5`),
  ],
)
