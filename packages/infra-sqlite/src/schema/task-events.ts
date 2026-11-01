import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { tasks } from './tasks.js'
import { users } from './users.js'

export const taskEvents = sqliteTable(
  'task_events',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    at: text('at').notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id),
    asManager: integer('as_manager', { mode: 'boolean' }).notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
  },
  (table) => [index('task_events_task_at_index').on(table.taskId, table.at)],
)
