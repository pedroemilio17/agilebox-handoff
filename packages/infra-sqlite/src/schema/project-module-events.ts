import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Histórico de mudanças de módulos por projeto (ADR-10, linha do tempo do projeto). Uma linha por
 * módulo afetado por um pedido. `auto` marca o que mudou por dependência (cascata); `related_module_id`
 * diz qual módulo puxou a mudança ("junto com Sprints"). `actor_role` guarda o papel de quem fez a
 * mudança naquele momento, para marcar as mudanças do gestor. Só cresce: nunca é apagado.
 */
export const projectModuleEvents = sqliteTable(
  'project_module_events',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    moduleId: text('module_id').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    actorRole: text('actor_role').notNull(),
    auto: integer('auto', { mode: 'boolean' }).notNull(),
    relatedModuleId: text('related_module_id'),
    at: text('at').notNull(),
  },
  (table) => [
    check(
      'project_module_events_action_check',
      sql`${table.action} IN ('enabled', 'disabled', 'winding_down', 'scheduled_disable', 'cancelled')`,
    ),
    check(
      'project_module_events_actor_role_check',
      sql`${table.actorRole} IN ('collaborator', 'manager')`,
    ),
    index('project_module_events_organization_project_at_idx').on(
      table.organizationId,
      table.projectId,
      table.at,
    ),
  ],
)
