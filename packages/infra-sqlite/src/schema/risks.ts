import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { deliverables } from './deliverables.js'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Riscos do projeto (ADR-10, módulo `risks`). `probability` e `impact` são 1 a 3; a situação é uma
 * de quatro (CHECK). Dono e entrega são opcionais. A regra de entrega do mesmo projeto fica no
 * repositório, como nos marcos.
 */
export const risks = sqliteTable(
  'risks',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description'),
    probability: integer('probability').notNull(),
    impact: integer('impact').notNull(),
    response: text('response'),
    ownerId: text('owner_id').references(() => users.id),
    deliverableId: text('deliverable_id').references(() => deliverables.id),
    status: text('status').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('risks_probability_check', sql`${table.probability} BETWEEN 1 AND 3`),
    check('risks_impact_check', sql`${table.impact} BETWEEN 1 AND 3`),
    check(
      'risks_status_check',
      sql`${table.status} IN ('open', 'mitigated', 'occurred', 'closed')`,
    ),
    index('risks_organization_project_index').on(table.organizationId, table.projectId),
  ],
)
