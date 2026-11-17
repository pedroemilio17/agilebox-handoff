import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { projects } from './projects.js'

/**
 * Configuração inicial do projeto: respostas do questionário, preset recomendado, preset de partida
 * e nível de guia. Uma linha por projeto. Sem linha, o projeto ainda não passou pela configuração.
 */
export const projectSetup = sqliteTable(
  'project_setup',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => projects.id),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    /** JSON com as respostas do questionário, ou nulo. */
    answers: text('answers'),
    recommendedPreset: text('recommended_preset'),
    startedFromPreset: text('started_from_preset'),
    guideLevel: text('guide_level'),
  },
  (table) => [
    check(
      'project_setup_recommended_preset_check',
      sql`${table.recommendedPreset} IS NULL OR ${table.recommendedPreset} IN ('simples', 'kanban', 'agil', 'tradicional', 'hibrido')`,
    ),
    check(
      'project_setup_started_from_preset_check',
      sql`${table.startedFromPreset} IS NULL OR ${table.startedFromPreset} IN ('simples', 'kanban', 'agil', 'tradicional', 'hibrido')`,
    ),
    check(
      'project_setup_guide_level_check',
      sql`${table.guideLevel} IS NULL OR ${table.guideLevel} IN ('never', 'sometimes', 'always')`,
    ),
    check(
      'project_setup_answers_json_check',
      sql`${table.answers} IS NULL OR json_valid(${table.answers})`,
    ),
  ],
)
