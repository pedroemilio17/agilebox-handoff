import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { tasks } from './tasks.js'
import { users } from './users.js'

export const taskOpens = sqliteTable(
  'task_opens',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    lastOpenedAt: text('last_opened_at').notNull(),
    openCount: integer('open_count').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.taskId] }),
    index('task_opens_user_last_opened_at_index').on(table.userId, table.lastOpenedAt),
  ],
)
