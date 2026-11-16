import { sql } from 'drizzle-orm'
import { check, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

/**
 * Ferramenta da equipe: uma linha por organização e módulo. Ferramenta sem linha conta como
 * desligada. `changed_by` e `changed_at` ficam nulos quando ninguém gravou a linha (padrão ou migração).
 */
export const teamModules = sqliteTable(
  'team_modules',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    /** Id do catálogo em `packages/core/src/modules/registry.ts`; a checagem fica no domínio. */
    moduleId: text('module_id').notNull(),
    state: text('state').notNull(),
    /** JSON com a configuração do módulo (objeto simples) ou nulo. */
    config: text('config'),
    changedBy: text('changed_by').references(() => users.id),
    changedAt: text('changed_at'),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.moduleId] }),
    check(
      'team_modules_state_check',
      sql`${table.state} IN ('active', 'winding_down', 'disabled')`,
    ),
    check(
      'team_modules_config_json_check',
      sql`${table.config} IS NULL OR json_valid(${table.config})`,
    ),
  ],
)
