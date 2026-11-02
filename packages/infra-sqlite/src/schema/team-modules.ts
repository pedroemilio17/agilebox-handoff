import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const teamModules = sqliteTable(
  'team_modules',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    moduleId: text('module_id').notNull(),
    state: text('state').notNull(),
    config: text('config', { mode: 'json' })
      .$type<Readonly<Record<string, string | number | boolean | null>>>()
      .notNull(),
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
    changedAt: text('changed_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.moduleId] })],
)
