import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultRateCents: integer('default_rate_cents').notNull().default(4500),
  createdAt: text('created_at').notNull(),
})
