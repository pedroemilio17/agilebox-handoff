import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const teamModuleEvents = sqliteTable(
  'team_module_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    moduleId: text('module_id').notNull(),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
    changedAt: text('changed_at').notNull(),
  },
  (table) => [index('team_module_events_org_at_index').on(table.organizationId, table.changedAt)],
)
