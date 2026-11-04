import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const dailyEntries = sqliteTable(
  'daily_entries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    /** Titular da daily. Some junto com o usuário (CASCADE). Entidades nunca entram aqui. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Data local (`YYYY-MM-DD`) informada pelo cliente. */
    date: text('date').notNull(),
    progress: text('progress').notNull().default(''),
    nextStep: text('next_step').notNull().default(''),
    blocker: text('blocker').notNull().default(''),
    noNews: integer('no_news', { mode: 'boolean' }).notNull().default(false),
    /** JSON com os ids das tarefas citadas (array de strings). */
    taskRefs: text('task_refs').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check(
      'daily_entries_answers_check',
      sql`length(${table.progress}) <= 500 AND length(${table.nextStep}) <= 500 AND length(${table.blocker}) <= 500`,
    ),
    uniqueIndex('daily_entries_org_user_date_unique').on(
      table.organizationId,
      table.userId,
      table.date,
    ),
  ],
)
