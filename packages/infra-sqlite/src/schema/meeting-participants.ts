import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { meetings } from './meetings.js'
import { users } from './users.js'

export const meetingParticipants = sqliteTable(
  'meeting_participants',
  {
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.userId] })],
)
