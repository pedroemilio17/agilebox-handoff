import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { meetings } from './meetings.js'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const retroActions = sqliteTable(
  'retro_actions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    occurrenceDate: text('occurrence_date').notNull(),
    title: text('title').notNull(),
    /** Só usuários. Some (SET NULL) se o usuário sair; entidades nunca entram aqui. */
    responsibleId: text('responsible_id').references(() => users.id, { onDelete: 'set null' }),
    dueDate: text('due_date'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    doneAt: text('done_at'),
    createdAt: text('created_at').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    check('retro_actions_title_check', sql`length(${table.title}) BETWEEN 1 AND 200`),
    index('retro_actions_meeting_occurrence_index').on(table.meetingId, table.occurrenceDate),
  ],
)
