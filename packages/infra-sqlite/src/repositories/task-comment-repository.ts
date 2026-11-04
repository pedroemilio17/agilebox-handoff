import { and, asc, count, eq, inArray } from 'drizzle-orm'
import type { TaskCommentRepository } from '@agilebox/application'
import type { OrganizationId, TaskComment, TaskCommentId, TaskId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapTaskCommentRow } from '../mappers/task-mappers.js'
import { tasks, taskComments, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteTaskCommentRepository(database: SqliteDatabase): TaskCommentRepository {
  return {
    async listByTask(organizationId: OrganizationId, taskId: TaskId) {
      const rows = await database
        .select()
        .from(taskComments)
        .where(
          and(eq(taskComments.organizationId, organizationId), eq(taskComments.taskId, taskId)),
        )
        .orderBy(asc(taskComments.createdAt), asc(taskComments.id))
      return rows.map(mapTaskCommentRow)
    },
    async countByTasks(organizationId: OrganizationId, taskIds: readonly TaskId[]) {
      if (taskIds.length === 0) return []
      const rows = await database
        .select({ taskId: taskComments.taskId, total: count() })
        .from(taskComments)
        .where(
          and(
            eq(taskComments.organizationId, organizationId),
            inArray(taskComments.taskId, [...taskIds]),
          ),
        )
        .groupBy(taskComments.taskId)
      return rows.map((row) => ({ taskId: row.taskId as TaskId, count: row.total }))
    },
    async findById(organizationId: OrganizationId, commentId: TaskCommentId) {
      const [row] = await database
        .select()
        .from(taskComments)
        .where(and(eq(taskComments.id, commentId), eq(taskComments.organizationId, organizationId)))
        .limit(1)
      return row ? mapTaskCommentRow(row) : null
    },
    async save(organizationId: OrganizationId, comment: TaskComment) {
      // Só grava comentário de tarefa e autor desta organização.
      const [task] = await database
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, comment.taskId), eq(tasks.organizationId, organizationId)))
        .limit(1)
      const [author] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, comment.authorId), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!task || !author) return
      const value = {
        id: comment.id,
        organizationId,
        taskId: comment.taskId,
        authorId: comment.authorId,
        body: comment.body,
        mentions: JSON.stringify(comment.mentions),
        createdAt: comment.createdAt,
        editedAt: comment.editedAt,
        asManager: comment.asManager,
      }
      await database
        .insert(taskComments)
        .values(value)
        .onConflictDoUpdate({
          target: taskComments.id,
          set: {
            body: value.body,
            mentions: value.mentions,
            editedAt: value.editedAt,
          },
          where: eq(taskComments.organizationId, organizationId),
        })
    },
    async remove(organizationId: OrganizationId, commentId: TaskCommentId) {
      await database
        .delete(taskComments)
        .where(and(eq(taskComments.id, commentId), eq(taskComments.organizationId, organizationId)))
    },
  }
}
