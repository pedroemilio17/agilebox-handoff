import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const teamSettings = sqliteTable('team_settings', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id),
  level: text('level').notNull(),
  changedBy: text('changed_by')
    .notNull()
    .references(() => users.id),
  changedAt: text('changed_at').notNull(),
})
