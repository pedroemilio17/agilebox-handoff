import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

/**
 * Impedimentos (M5.2a). Histórico nunca é apagado: resolver só fecha a linha (`status`, `resolved_*`).
 * No máximo um `open` por tarefa, garantido pelo índice parcial (e checado no domínio). O responsável
 * por resolver (`owner_id`) é nulo quando não há. Índices: por tarefa e por responsável aberto.
 */
export const taskImpediments = sqliteTable(
  'task_impediments',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    reason: text('reason').notNull(),
    status: text('status').notNull(),
    ownerId: text('owner_id').references(() => users.id),
    openedBy: text('opened_by')
      .notNull()
      .references(() => users.id),
    openedAt: text('opened_at').notNull(),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolvedAt: text('resolved_at'),
    resolution: text('resolution'),
  },
  (table) => [
    check('task_impediments_status_check', sql`${table.status} IN ('open', 'resolved')`),
    check('task_impediments_reason_check', sql`length(${table.reason}) BETWEEN 1 AND 280`),
    check(
      'task_impediments_resolution_check',
      sql`${table.resolution} IS NULL OR length(${table.resolution}) BETWEEN 1 AND 280`,
    ),
    check(
      'task_impediments_resolved_pair_check',
      sql`(${table.resolvedAt} IS NULL) = (${table.resolvedBy} IS NULL)`,
    ),
    check(
      'task_impediments_open_state_check',
      sql`(${table.status} = 'open') = (${table.resolvedAt} IS NULL)`,
    ),
    uniqueIndex('task_impediments_one_open_per_task_unique')
      .on(table.organizationId, table.taskId)
      .where(sql`${table.status} = 'open'`),
    index('task_impediments_organization_task_index').on(table.organizationId, table.taskId),
    index('task_impediments_open_owner_index')
      .on(table.organizationId, table.ownerId)
      .where(sql`${table.status} = 'open'`),
  ],
)
