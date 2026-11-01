import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const contributors = sqliteTable('contributors', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  source: text('source', { enum: ['manual', 'azure'] }).notNull(),
  externalId: text('external_id'),
  defaultRateCents: integer('default_rate_cents').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
})
