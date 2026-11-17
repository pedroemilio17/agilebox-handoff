import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

/**
 * Progresso do guia de alimentação (ADR-10), por pessoa e por projeto. Uma linha por passo
 * concluído (`step_key` é o id do passo no manifesto do módulo) e, opcionalmente, a linha reservada
 * `step_key = '__card__'`, que guarda a dispensa do cartão "Primeiros passos" pela pessoa naquele
 * projeto (`dismissed = 1`). A chave reservada nunca aparece na trilha: não é um passo.
 *
 * `done_at` nulo significa que a linha existe só por causa da dispensa. Nunca se regrava o
 * `done_at` de um passo já concluído: o primeiro instante vale.
 */
export const guideProgress = sqliteTable(
  'guide_progress',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** Id estável do passo no manifesto, ou `'__card__'` (dispensa do cartão). */
    stepKey: text('step_key').notNull(),
    doneAt: text('done_at'),
    dismissed: integer('dismissed', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId, table.stepKey] }),
    index('guide_progress_organization_project_user_idx').on(
      table.organizationId,
      table.projectId,
      table.userId,
    ),
    check('guide_progress_dismissed_check', sql`${table.dismissed} IN (0, 1)`),
  ],
)
