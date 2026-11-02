import { and, asc, eq } from 'drizzle-orm'
import type { TaskCriteriaRepository } from '@agilebox/application'
import type { AcceptanceCriterion, OrganizationId, TaskId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapCriterionRow } from '../mappers/task-mappers.js'
import { taskCriteria, tasks } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteTaskCriteriaRepository(
  database: SqliteDatabase,
): TaskCriteriaRepository {
  return {
    async listByTask(organizationId: OrganizationId, taskId: TaskId) {
      const rows = await database
        .select()
        .from(taskCriteria)
        .where(
          and(eq(taskCriteria.organizationId, organizationId), eq(taskCriteria.taskId, taskId)),
        )
        .orderBy(asc(taskCriteria.position))
      return rows.map(mapCriterionRow)
    },
    async replaceForTask(
      organizationId: OrganizationId,
      taskId: TaskId,
      criteria: readonly AcceptanceCriterion[],
    ) {
      const [task] = await database
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!task) return
      // Apagar e gravar na mesma transação: id repetido (ou usado por outra tarefa) desfaz o apagar.
      database.transaction((tx) => {
        tx.delete(taskCriteria)
          .where(
            and(eq(taskCriteria.organizationId, organizationId), eq(taskCriteria.taskId, taskId)),
          )
          .run()
        if (criteria.length) {
          tx.insert(taskCriteria)
            .values(
              criteria.map((criterion, position) => ({
                id: criterion.id,
                organizationId,
                taskId,
                text: criterion.text,
                done: criterion.done,
                position,
              })),
            )
            .run()
        }
      })
    },
  }
}
