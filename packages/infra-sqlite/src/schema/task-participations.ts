import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { contributors } from './contributors.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

export const taskParticipations = sqliteTable(
  'task_participations',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    userId: text('user_id').references(() => users.id),
    contributorId: text('contributor_id').references(() => contributors.id),
    role: text('role', { enum: ['responsible', 'support'] }).notNull(),
    hoursHundredths: integer('hours_hundredths').notNull(),
    rateCents: integer('rate_cents').notNull(),
    addedAt: text('added_at').notNull(),
  },
  (table) => [
    check(
      'task_participations_exactly_one_owner_check',
      sql`((${table.userId} IS NOT NULL) AND (${table.contributorId} IS NULL)) OR ((${table.userId} IS NULL) AND (${table.contributorId} IS NOT NULL))`,
    ),
    check(
      'task_participations_responsible_user_check',
      sql`${table.role} <> 'responsible' OR ${table.userId} IS NOT NULL`,
    ),
    check('task_participations_role_check', sql`${table.role} IN ('responsible', 'support')`),
    uniqueIndex('task_participations_task_user_unique').on(table.taskId, table.userId),
    uniqueIndex('task_participations_task_contributor_unique').on(
      table.taskId,
      table.contributorId,
    ),
    uniqueIndex('task_participations_one_responsible_unique')
      .on(table.taskId)
      .where(sql`${table.role} = 'responsible'`),
    index('task_participations_user_index').on(table.userId),
    index('task_participations_contributor_index').on(table.contributorId),
  ],
)
