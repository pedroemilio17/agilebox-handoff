import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { projects } from './projects.js'
import { users } from './users.js'

export const projectMembers = sqliteTable(
  'project_members',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    addedBy: text('added_by')
      .notNull()
      .references(() => users.id),
    addedAt: text('added_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
)
