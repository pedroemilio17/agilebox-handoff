import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

export const taskComments = sqliteTable(
  'task_comments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** JSON com os ids dos usuários mencionados (array de strings). */
    mentions: text('mentions').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
    editedAt: text('edited_at'),
    asManager: integer('as_manager', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    check('task_comments_body_check', sql`length(${table.body}) BETWEEN 1 AND 2000`),
    index('task_comments_task_created_index').on(table.taskId, table.createdAt),
  ],
)
