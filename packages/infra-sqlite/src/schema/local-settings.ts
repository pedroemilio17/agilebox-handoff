import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const localSettings = sqliteTable('local_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
