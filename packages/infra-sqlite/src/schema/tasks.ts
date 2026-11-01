import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status', {
      enum: ['planning', 'todo', 'in_progress', 'review', 'done'],
    }).notNull(),
    deadline: text('deadline'),
    ticketId: text('ticket_id'),
    ticketUrl: text('ticket_url'),
    searchText: text('search_text').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check(
      'tasks_status_check',
      sql`${table.status} IN ('planning', 'todo', 'in_progress', 'review', 'done')`,
    ),
    index('tasks_organization_project_index').on(table.organizationId, table.projectId),
    index('tasks_organization_updated_at_index').on(table.organizationId, table.updatedAt),
  ],
)
