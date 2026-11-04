import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const meetings = sqliteTable(
  'meetings',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    title: text('title').notNull(),
    date: text('date').notNull(),
    time: text('time').notNull(),
    endTime: text('end_time'),
    kind: text('kind').notNull().default('meeting'),
    recurrence: text('recurrence').notNull().default('none'),
    recurrenceUntil: text('recurrence_until'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('meetings_organization_date_index').on(table.organizationId, table.date),
    check('meetings_kind_check', sql`${table.kind} IN ('meeting', 'review', 'retro')`),
    check('meetings_recurrence_check', sql`${table.recurrence} IN ('none', 'weekly')`),
  ],
)
