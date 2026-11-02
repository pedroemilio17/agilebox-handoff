import { sql } from 'drizzle-orm'
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { users } from './users.js'

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (table) => [
    // Único só entre projetos ativos: um arquivado não bloqueia um novo com o mesmo nome.
    uniqueIndex('projects_organization_name_key_unique')
      .on(table.organizationId, table.nameKey)
      .where(sql`archived_at IS NULL`),
  ],
)
