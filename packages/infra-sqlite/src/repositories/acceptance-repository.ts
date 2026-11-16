import { and, asc, eq } from 'drizzle-orm'
import type { AcceptanceRepository } from '@agilebox/application'
import type { AcceptanceCriterion, AcceptanceCriterionId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapAcceptanceCriterionRow } from '../mappers/task-mappers.js'
import { taskAcceptanceCriteria, tasks } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteAcceptanceRepository(database: SqliteDatabase): AcceptanceRepository {
  return {
    async listByTask(organizationId, taskId) {
      const rows = await database
        .select()
        .from(taskAcceptanceCriteria)
        .where(
          and(
            eq(taskAcceptanceCriteria.organizationId, organizationId),
            eq(taskAcceptanceCriteria.taskId, taskId),
          ),
        )
        .orderBy(asc(taskAcceptanceCriteria.position))
      return rows.map(mapAcceptanceCriterionRow)
    },
    async saveMany(organizationId, criteria: readonly AcceptanceCriterion[]) {
      for (const criterion of criteria) {
        // Só grava critério de tarefa desta organização.
        const [task] = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, criterion.taskId), eq(tasks.organizationId, organizationId)))
          .limit(1)
        if (!task) continue
        const value = {
          id: criterion.id,
          organizationId,
          taskId: criterion.taskId,
          text: criterion.text,
          done: criterion.done,
          position: criterion.position,
          createdAt: criterion.createdAt,
          updatedAt: criterion.updatedAt,
        }
        await database
          .insert(taskAcceptanceCriteria)
          .values(value)
          .onConflictDoUpdate({
            target: taskAcceptanceCriteria.id,
            set: value,
            where: eq(taskAcceptanceCriteria.organizationId, organizationId),
          })
      }
    },
    async remove(organizationId, criterionId: AcceptanceCriterionId) {
      await database
        .delete(taskAcceptanceCriteria)
        .where(
          and(
            eq(taskAcceptanceCriteria.id, criterionId),
            eq(taskAcceptanceCriteria.organizationId, organizationId),
          ),
        )
    },
  }
}
