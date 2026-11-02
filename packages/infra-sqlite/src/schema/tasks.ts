import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
    archivedAt: text('archived_at'),
    /** Posição no backlog do time (nulo = fora do backlog). Ver `values/backlog-order.ts` no core. */
    backlogRank: integer('backlog_rank'),
    /** Aparece no quadro. Invariante: `on_board` é verdadeiro exatamente quando `backlog_rank` é nulo. */
    onBoard: integer('on_board', { mode: 'boolean' }).notNull().default(true),
    /** Estimativa em centésimos de hora (nulo = sem estimativa). Ver ADR 0005. */
    estimatedHours: integer('estimated_hours'),
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
