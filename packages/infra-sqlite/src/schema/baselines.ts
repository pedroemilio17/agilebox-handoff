import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { tasks } from './tasks.js'
import { users } from './users.js'

/**
 * Fotos da linha de base do projeto (ADR-10, módulo `baseline`). Cada foto é imutável; a mais recente
 * do projeto é a de comparação. `taken_at` é instante ISO em UTC.
 */
export const baselines = sqliteTable(
  'baselines',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    takenAt: text('taken_at').notNull(),
    takenBy: text('taken_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('baselines_organization_project_taken_at_index').on(
      table.organizationId,
      table.projectId,
      table.takenAt,
    ),
  ],
)

/**
 * Linha da foto: a tarefa como estava na data. Datas `YYYY-MM-DD` (nulas se a tarefa não tinha),
 * horas em centésimos e custo em centavos (nulos sem estimativa, sem valor ou sem o módulo `cost`).
 */
export const baselineTasks = sqliteTable(
  'baseline_tasks',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    baselineId: text('baseline_id')
      .notNull()
      .references(() => baselines.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    title: text('title').notNull(),
    startsOn: text('starts_on'),
    endsOn: text('ends_on'),
    estimatedHoursHundredths: integer('estimated_hours_hundredths'),
    plannedCostCents: integer('planned_cost_cents'),
  },
  (table) => [primaryKey({ columns: [table.baselineId, table.taskId] })],
)
