import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

/** Nível da equipe: uma linha por organização. Sem linha, vale o padrão de código (Avançado). */
export const teamPreferences = sqliteTable(
  'team_preferences',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organizations.id),
    experienceLevel: text('experience_level').notNull(),
    changedBy: text('changed_by').references(() => users.id),
    changedAt: text('changed_at'),
  },
  (table) => [
    check(
      'team_preferences_level_check',
      sql`${table.experienceLevel} IN ('basic', 'intermediate', 'advanced')`,
    ),
  ],
)
