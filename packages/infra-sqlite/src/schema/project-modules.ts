import { sql } from 'drizzle-orm'
import { check, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Módulo ligado num projeto: uma linha por projeto e módulo. Módulo sem linha conta como desligado.
 * `changed_by` e `changed_at` ficam nulos quando ninguém gravou a linha (padrão ou migração).
 */
export const projectModules = sqliteTable(
  'project_modules',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    /** Id do catálogo em `packages/core/src/modules/registry.ts`; a checagem fica no domínio. */
    moduleId: text('module_id').notNull(),
    state: text('state').notNull(),
    /** JSON com a configuração do módulo (objeto simples) ou nulo. */
    config: text('config'),
    changedBy: text('changed_by').references(() => users.id),
    changedAt: text('changed_at'),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.moduleId] }),
    index('project_modules_organization_project_idx').on(table.organizationId, table.projectId),
    check(
      'project_modules_state_check',
      sql`${table.state} IN ('active', 'winding_down', 'disabled')`,
    ),
    check(
      'project_modules_config_json_check',
      sql`${table.config} IS NULL OR json_valid(${table.config})`,
    ),
  ],
)
