import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Sprints (M4.2). Número sequencial por projeto, único dentro da organização e do projeto. O
 * descarte é lógico (`discarded_at`): a linha nunca some e o número nunca se reaproveita.
 * `close_policy` guarda o JSON da política de encerramento (nulo até encerrar).
 */
export const sprints = sqliteTable(
  'sprints',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    goal: text('goal'),
    plannedStart: text('planned_start').notNull(),
    plannedEnd: text('planned_end').notNull(),
    status: text('status').notNull(),
    startedAt: text('started_at'),
    closedAt: text('closed_at'),
    closePolicy: text('close_policy'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    discardedAt: text('discarded_at'),
    discardedBy: text('discarded_by').references(() => users.id),
  },
  (table) => [
    check('sprints_status_check', sql`${table.status} IN ('draft', 'active', 'closed')`),
    check(
      'sprints_discard_pair_check',
      sql`(${table.discardedAt} IS NULL) = (${table.discardedBy} IS NULL)`,
    ),
    uniqueIndex('sprints_organization_project_number_unique').on(
      table.organizationId,
      table.projectId,
      table.number,
    ),
    index('sprints_organization_project_status_index').on(
      table.organizationId,
      table.projectId,
      table.status,
    ),
  ],
)
