import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { ConflictError } from '@agilebox/core'
import type { Impediment, ImpedimentId, OrganizationId, TaskId } from '@agilebox/core'
import type { ImpedimentListFilter, ImpedimentRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapImpedimentRow } from '../mappers/impediment-mappers.js'
import { taskImpediments, tasks } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/** Ordem estável: o mais antigo primeiro, desempate pelo id. */
const byOpening = [asc(taskImpediments.openedAt), asc(taskImpediments.id)]

/**
 * Impedimentos em SQLite (M5.2a). Toda consulta filtra pela organização. Resolver só fecha a linha:
 * nada é apagado, e o índice parcial impede dois abertos na mesma tarefa.
 */
export function createSqliteImpedimentRepository(database: SqliteDatabase): ImpedimentRepository {
  return {
    async findById(organizationId: OrganizationId, impedimentId: ImpedimentId) {
      const [row] = await database
        .select()
        .from(taskImpediments)
        .where(
          and(
            eq(taskImpediments.organizationId, organizationId),
            eq(taskImpediments.id, impedimentId),
          ),
        )
        .limit(1)
      return row ? mapImpedimentRow(row) : null
    },
    async findOpenByTask(organizationId: OrganizationId, taskId: TaskId) {
      const [row] = await database
        .select()
        .from(taskImpediments)
        .where(
          and(
            eq(taskImpediments.organizationId, organizationId),
            eq(taskImpediments.taskId, taskId),
            eq(taskImpediments.status, 'open'),
          ),
        )
        .limit(1)
      return row ? mapImpedimentRow(row) : null
    },
    async listByTask(organizationId: OrganizationId, taskId: TaskId) {
      const rows = await database
        .select()
        .from(taskImpediments)
        .where(
          and(
            eq(taskImpediments.organizationId, organizationId),
            eq(taskImpediments.taskId, taskId),
          ),
        )
        .orderBy(...byOpening)
      return rows.map(mapImpedimentRow)
    },
    async listOpenByTasks(organizationId: OrganizationId, taskIds: readonly TaskId[]) {
      if (taskIds.length === 0) return []
      const rows = await database
        .select()
        .from(taskImpediments)
        .where(
          and(
            eq(taskImpediments.organizationId, organizationId),
            inArray(taskImpediments.taskId, [...taskIds]),
            eq(taskImpediments.status, 'open'),
          ),
        )
        .orderBy(...byOpening)
      return rows.map(mapImpedimentRow)
    },
    async listByOrganization(organizationId: OrganizationId, filter: ImpedimentListFilter) {
      const rows = await database
        .select()
        .from(taskImpediments)
        .where(
          and(
            eq(taskImpediments.organizationId, organizationId),
            filter.includeResolved ? undefined : eq(taskImpediments.status, 'open'),
            filter.ownerId === undefined ? undefined : eq(taskImpediments.ownerId, filter.ownerId),
          ),
        )
        .orderBy(...byOpening)
      return rows.map(mapImpedimentRow)
    },
    async countByOrganization(organizationId: OrganizationId) {
      const [row] = await database
        .select({ total: count() })
        .from(taskImpediments)
        .where(eq(taskImpediments.organizationId, organizationId))
      return Number(row?.total ?? 0)
    },
    async save(organizationId: OrganizationId, impediment: Impediment) {
      // Impedimento de outra organização não é regravado; a tarefa também precisa ser dela.
      const [owner] = await database
        .select({ organizationId: taskImpediments.organizationId })
        .from(taskImpediments)
        .where(eq(taskImpediments.id, impediment.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      const [task] = await database
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, impediment.taskId), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!task) return
      if (impediment.status === 'open') {
        const [open] = await database
          .select({ id: taskImpediments.id })
          .from(taskImpediments)
          .where(
            and(
              eq(taskImpediments.organizationId, organizationId),
              eq(taskImpediments.taskId, impediment.taskId),
              eq(taskImpediments.status, 'open'),
            ),
          )
          .limit(1)
        if (open && open.id !== impediment.id)
          throw new ConflictError('Tarefa já tem um impedimento aberto')
      }
      const value = {
        organizationId,
        id: impediment.id,
        taskId: impediment.taskId,
        reason: impediment.reason,
        status: impediment.status,
        ownerId: impediment.ownerId,
        openedBy: impediment.openedBy,
        openedAt: impediment.openedAt,
        resolvedBy: impediment.resolvedBy,
        resolvedAt: impediment.resolvedAt,
        resolution: impediment.resolution,
      }
      await database
        .insert(taskImpediments)
        .values(value)
        .onConflictDoUpdate({
          target: taskImpediments.id,
          set: value,
          setWhere: eq(taskImpediments.organizationId, organizationId),
        })
    },
  }
}
