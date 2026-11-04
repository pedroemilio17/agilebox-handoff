import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.js'
import { users } from './users.js'

/** Limites de WIP da organização: uma linha por organização (sem linha = sem limites). */
export const boardSettings = sqliteTable(
  'board_settings',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .unique()
      .references(() => organizations.id),
    /** JSON com o limite por coluna, ex.: {"in_progress":3,"review":2}. */
    wipLimits: text('wip_limits').notNull().default('{}'),
    updatedAt: text('updated_at').notNull(),
    updatedBy: text('updated_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [check('board_settings_wip_limits_json_check', sql`json_valid(${table.wipLimits})`)],
)
