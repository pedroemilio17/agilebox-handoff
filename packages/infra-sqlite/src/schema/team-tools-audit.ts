import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

/** Quem ligou ou desligou, quando e o que mudou nas ferramentas e no nível da equipe. Só cresce. */
export const teamToolsAudit = sqliteTable(
  'team_tools_audit',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    /** Nulo para nível; obrigatório para estado de ferramenta. */
    moduleId: text('module_id'),
    before: text('before'),
    after: text('after'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('team_tools_audit_kind_check', sql`${table.kind} IN ('module_state', 'level', 'preset')`),
    check(
      'team_tools_audit_module_check',
      sql`${table.kind} <> 'module_state' OR ${table.moduleId} IS NOT NULL`,
    ),
    index('team_tools_audit_organization_created_idx').on(table.organizationId, table.createdAt),
  ],
)
