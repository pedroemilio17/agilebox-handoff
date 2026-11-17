import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { deliverables } from './deliverables.js'
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
    number: integer('number').notNull(),
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
    priority: text('priority', { enum: ['normal', 'high'] })
      .notNull()
      .default('normal'),
    blockedReason: text('blocked_reason'),
    blockedAt: text('blocked_at'),
    archivedAt: text('archived_at'),
    archivedBy: text('archived_by').references(() => users.id),
    /** Posição no backlog do projeto (M3.1). Nulo = a tarefa está no quadro. */
    backlogRank: integer('backlog_rank'),
    /**
     * Estimativa em centésimos de hora (ADR-07, M3.2). Nulo = sem estimativa. Sem CHECK de faixa de propósito:
     * adicionar CHECK exige reconstruir `tasks` (DROP + cópia), e o DROP dispara o cascade das filhas. A faixa
     * (0 a 9999 h) é validada no domínio (`estimateToHundredths`) e no contrato.
     */
    estimatedHoursHundredths: integer('estimated_hours_hundredths'),
    /** Entrega da EAP à qual a tarefa aponta (ADR-10). Nulo = sem entrega. */
    deliverableId: text('deliverable_id').references(() => deliverables.id),
    /** Início da tarefa (ADR-10, cronograma). Nulo = sem início; o fim é `deadline`. */
    startsOn: text('starts_on'),
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
    check('tasks_priority_check', sql`${table.priority} IN ('normal', 'high')`),
    check(
      'tasks_blocked_reason_check',
      sql`${table.blockedReason} IS NULL OR length(${table.blockedReason}) BETWEEN 1 AND 280`,
    ),
    uniqueIndex('tasks_organization_number_unique').on(table.organizationId, table.number),
    index('tasks_organization_project_index').on(table.organizationId, table.projectId),
    index('tasks_organization_updated_at_index').on(table.organizationId, table.updatedAt),
    index('tasks_organization_deliverable_index').on(table.organizationId, table.deliverableId),
    index('tasks_organization_project_backlog_index').on(
      table.organizationId,
      table.projectId,
      table.backlogRank,
    ),
  ],
)
