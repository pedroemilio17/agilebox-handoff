import { uniqueIndex } from 'drizzle-orm/sqlite-core'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    initials: text('initials').notNull(),
    role: text('role', { enum: ['collaborator', 'manager'] }).notNull(),
    defaultRateCents: integer('default_rate_cents').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('users_organization_email_unique').on(table.organizationId, table.email)],
)
