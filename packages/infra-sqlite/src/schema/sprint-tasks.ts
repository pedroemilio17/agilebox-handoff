import { sql } from 'drizzle-orm'
import { check, index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { sprints } from './sprints.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

/**
 * Histórico de tarefas em sprints (M4.2). Chave: sprint, tarefa e entrada. Sair da sprint só fecha a
 * linha (`removed_at`, `removed_by`, `outcome`); nada é apagado. A unicidade de linha aberta por
 * tarefa é um índice parcial, e o domínio e o repositório também a checam.
 */
export const sprintTasks = sqliteTable(
  'sprint_tasks',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    sprintId: text('sprint_id')
      .notNull()
      .references(() => sprints.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    addedAt: text('added_at').notNull(),
    addedBy: text('added_by')
      .notNull()
      .references(() => users.id),
    removedAt: text('removed_at'),
    removedBy: text('removed_by').references(() => users.id),
    outcome: text('outcome').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sprintId, table.taskId, table.addedAt] }),
    check(
      'sprint_tasks_outcome_check',
      sql`${table.outcome} IN ('open', 'completed', 'returned_to_backlog', 'carried_over', 'removed', 'left_on_board')`,
    ),
    check(
      'sprint_tasks_open_outcome_check',
      sql`(${table.removedAt} IS NULL) = (${table.outcome} = 'open')`,
    ),
    check(
      'sprint_tasks_removed_pair_check',
      sql`(${table.removedAt} IS NULL) = (${table.removedBy} IS NULL)`,
    ),
    uniqueIndex('sprint_tasks_one_open_per_task_unique')
      .on(table.organizationId, table.taskId)
      .where(sql`${table.removedAt} IS NULL`),
    index('sprint_tasks_organization_sprint_index').on(table.organizationId, table.sprintId),
  ],
)
