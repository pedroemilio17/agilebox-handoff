import { sql } from 'drizzle-orm'
import { check, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

/**
 * Dependências término→início entre tarefas do mesmo projeto (ADR-10, cronograma). A chave composta
 * impede duplicata; o CHECK impede a tarefa de depender de si mesma. Ciclo e projeto são validados no
 * domínio (`rules/schedule.ts`).
 */
export const taskDependencies = sqliteTable(
  'task_dependencies',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    predecessorId: text('predecessor_id')
      .notNull()
      .references(() => tasks.id),
    successorId: text('successor_id')
      .notNull()
      .references(() => tasks.id),
    createdAt: text('created_at').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    primaryKey({ columns: [table.predecessorId, table.successorId] }),
    check('task_dependencies_not_self_check', sql`${table.predecessorId} <> ${table.successorId}`),
    index('task_dependencies_organization_successor_index').on(
      table.organizationId,
      table.successorId,
    ),
    index('task_dependencies_organization_predecessor_index').on(
      table.organizationId,
      table.predecessorId,
    ),
  ],
)
