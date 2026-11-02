import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { organizations } from './organizations.js'
import { tasks } from './tasks.js'

/**
 * Critérios de aceite de uma tarefa (M3.9). A ordem é a posição (0-based), a mesma ordem da lista
 * do core. Não tem data de criação: o valor do core (`AcceptanceCriterion`) também não tem.
 * Apagar ou arquivar a tarefa não apaga os critérios (tarefas não são apagadas no MVP).
 */
export const taskCriteria = sqliteTable(
  'task_criteria',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    text: text('text').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
  },
  (table) => [uniqueIndex('task_criteria_task_position_unique').on(table.taskId, table.position)],
)
