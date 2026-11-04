import { and, asc, eq, inArray } from 'drizzle-orm'
import type { ChecklistRepository } from '@agilebox/application'
import type { ChecklistItem, ChecklistItemId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapChecklistItemRow } from '../mappers/task-mappers.js'
import { taskChecklistItems, tasks } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteChecklistRepository(database: SqliteDatabase): ChecklistRepository {
  return {
    async listByTask(organizationId, taskId) {
      const rows = await database
        .select()
        .from(taskChecklistItems)
        .where(
          and(
            eq(taskChecklistItems.organizationId, organizationId),
            eq(taskChecklistItems.taskId, taskId),
          ),
        )
        .orderBy(asc(taskChecklistItems.position))
      return rows.map(mapChecklistItemRow)
    },
    async listByTasks(organizationId, taskIds) {
      if (taskIds.length === 0) return []
      const rows = await database
        .select()
        .from(taskChecklistItems)
        .where(
          and(
            eq(taskChecklistItems.organizationId, organizationId),
            inArray(taskChecklistItems.taskId, [...taskIds]),
          ),
        )
        .orderBy(asc(taskChecklistItems.position))
      return rows.map(mapChecklistItemRow)
    },
    async saveMany(organizationId, items: readonly ChecklistItem[]) {
      for (const item of items) {
        // Só grava item de tarefa desta organização.
        const [task] = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, item.taskId), eq(tasks.organizationId, organizationId)))
          .limit(1)
        if (!task) continue
        const value = {
          id: item.id,
          organizationId,
          taskId: item.taskId,
          title: item.title,
          done: item.done,
          position: item.position,
          createdAt: item.createdAt,
          doneAt: item.doneAt,
        }
        await database
          .insert(taskChecklistItems)
          .values(value)
          .onConflictDoUpdate({
            target: taskChecklistItems.id,
            set: value,
            where: eq(taskChecklistItems.organizationId, organizationId),
          })
      }
    },
    async remove(organizationId, itemId: ChecklistItemId) {
      await database
        .delete(taskChecklistItems)
        .where(
          and(
            eq(taskChecklistItems.id, itemId),
            eq(taskChecklistItems.organizationId, organizationId),
          ),
        )
    },
  }
}
