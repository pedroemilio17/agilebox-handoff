import { and, eq, or } from 'drizzle-orm'
import { ConflictError, ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId, TaskDependency, TaskId } from '@agilebox/core'
import type { TaskDependencyRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapTaskDependencyRow } from '../mappers/task-dependency-mappers.js'
import { taskDependencies, tasks } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Dependências término→início (ADR-10). Toda consulta filtra pela organização. Tarefa de outra
 * organização (predecessora ou sucessora) é recusada com VALIDAÇÃO, sem gravar nada.
 */
export function createSqliteTaskDependencyRepository(
  database: SqliteDatabase,
): TaskDependencyRepository {
  return {
    async listByProject(organizationId: OrganizationId, projectId: ProjectId) {
      const rows = await database
        .select({ dependency: taskDependencies })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.successorId, tasks.id))
        .where(
          and(
            eq(taskDependencies.organizationId, organizationId),
            eq(tasks.organizationId, organizationId),
            eq(tasks.projectId, projectId),
          ),
        )
      return rows.map((row) => mapTaskDependencyRow(row.dependency))
    },
    async listByTask(organizationId: OrganizationId, taskId: TaskId) {
      const rows = await database
        .select()
        .from(taskDependencies)
        .where(
          and(
            eq(taskDependencies.organizationId, organizationId),
            or(
              eq(taskDependencies.predecessorId, taskId),
              eq(taskDependencies.successorId, taskId),
            ),
          ),
        )
      return rows.map(mapTaskDependencyRow)
    },
    async add(organizationId: OrganizationId, dependency: TaskDependency) {
      for (const taskId of [dependency.predecessorId, dependency.successorId]) {
        const [task] = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
          .limit(1)
        if (!task) throw new ValidationError('Tarefa não encontrada nesta organização')
      }
      const [existing] = await database
        .select({ predecessorId: taskDependencies.predecessorId })
        .from(taskDependencies)
        .where(
          and(
            eq(taskDependencies.predecessorId, dependency.predecessorId),
            eq(taskDependencies.successorId, dependency.successorId),
          ),
        )
        .limit(1)
      if (existing) throw new ConflictError('Esta dependência já existe')
      await database.insert(taskDependencies).values({
        organizationId,
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        createdAt: dependency.createdAt,
        createdBy: dependency.createdBy,
      })
    },
    async remove(organizationId: OrganizationId, predecessorId: TaskId, successorId: TaskId) {
      await database
        .delete(taskDependencies)
        .where(
          and(
            eq(taskDependencies.organizationId, organizationId),
            eq(taskDependencies.predecessorId, predecessorId),
            eq(taskDependencies.successorId, successorId),
          ),
        )
    },
  }
}
