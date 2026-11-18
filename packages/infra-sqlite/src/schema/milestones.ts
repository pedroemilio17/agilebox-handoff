import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { deliverables } from './deliverables.js'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/** Marcos do projeto (ADR-10). `due_on` é `YYYY-MM-DD`, sem hora. */
export const milestones = sqliteTable(
  'milestones',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    dueOn: text('due_on').notNull(),
    deliverableId: text('deliverable_id').references(() => deliverables.id),
    criterion: text('criterion'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('milestones_organization_project_due_on_index').on(
      table.organizationId,
      table.projectId,
      table.dueOn,
    ),
  ],
)
