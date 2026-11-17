import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { ConflictError } from '@agilebox/core'
import type { Sprint, SprintId, SprintStatus, TaskId, UserId } from '@agilebox/core'
import type { SprintRepository, SprintTaskRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { closePolicyToText, mapSprintRow, mapSprintTaskRow } from '../mappers/sprint-mappers.js'
import { projects, sprints, sprintTasks, tasks, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Sprints e histórico em SQLite (M4.2). Toda consulta filtra pela organização. Descartada (linha com
 * `discarded_at`) some das leituras, mas continua no banco e conta para o número sequencial.
 */
export function createSqliteSprintRepositories(database: SqliteDatabase): {
  readonly sprints: SprintRepository
  readonly sprintTasks: SprintTaskRepository
} {
  const sprintRepository: SprintRepository = {
    async findById(organizationId, sprintId) {
      const [row] = await database
        .select()
        .from(sprints)
        .where(
          and(
            eq(sprints.organizationId, organizationId),
            eq(sprints.id, sprintId),
            isNull(sprints.discardedAt),
          ),
        )
        .limit(1)
      return row ? mapSprintRow(row) : null
    },
    async listByProject(organizationId, projectId, status?: SprintStatus) {
      const rows = await database
        .select()
        .from(sprints)
        .where(
          and(
            eq(sprints.organizationId, organizationId),
            eq(sprints.projectId, projectId),
            isNull(sprints.discardedAt),
            status === undefined ? undefined : eq(sprints.status, status),
          ),
        )
        .orderBy(asc(sprints.number))
      return rows.map(mapSprintRow)
    },
    async nextNumber(organizationId, projectId) {
      const [row] = await database
        .select({ current: sql<number>`coalesce(max(${sprints.number}), 0)` })
        .from(sprints)
        .where(and(eq(sprints.organizationId, organizationId), eq(sprints.projectId, projectId)))
      return Number(row?.current ?? 0) + 1
    },
    async countActive(organizationId, projectId) {
      const [row] = await database
        .select({ total: sql<number>`count(*)` })
        .from(sprints)
        .where(
          and(
            eq(sprints.organizationId, organizationId),
            eq(sprints.projectId, projectId),
            eq(sprints.status, 'active'),
            isNull(sprints.discardedAt),
          ),
        )
      return Number(row?.total ?? 0)
    },
    async countNotClosed(organizationId) {
      const [row] = await database
        .select({ total: sql<number>`count(*)` })
        .from(sprints)
        .where(
          and(
            eq(sprints.organizationId, organizationId),
            ne(sprints.status, 'closed'),
            isNull(sprints.discardedAt),
          ),
        )
      return Number(row?.total ?? 0)
    },
    async save(organizationId, sprint: Sprint) {
      // Sprint de outra organização não é regravada; projeto e criador também precisam ser dela.
      const [owner] = await database
        .select({ organizationId: sprints.organizationId })
        .from(sprints)
        .where(eq(sprints.id, sprint.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, sprint.projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      const [creator] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, sprint.createdBy), eq(users.organizationId, organizationId)))
        .limit(1)
      if (!project || !creator) return
      // O descarte não entra aqui: quem marca o descarte é `markDiscarded`, e o upsert não o apaga.
      const value = {
        organizationId,
        id: sprint.id,
        projectId: sprint.projectId,
        number: sprint.number,
        name: sprint.name,
        goal: sprint.goal,
        plannedStart: sprint.plannedStart,
        plannedEnd: sprint.plannedEnd,
        status: sprint.status,
        startedAt: sprint.startedAt,
        closedAt: sprint.closedAt,
        closePolicy: closePolicyToText(sprint.closePolicy),
        createdBy: sprint.createdBy,
        createdAt: sprint.createdAt,
      }
      await database
        .insert(sprints)
        .values(value)
        .onConflictDoUpdate({
          target: sprints.id,
          set: value,
          setWhere: eq(sprints.organizationId, organizationId),
        })
    },
    async markDiscarded(organizationId, sprintId, at, by: UserId) {
      await database
        .update(sprints)
        .set({ discardedAt: at, discardedBy: by })
        .where(
          and(
            eq(sprints.organizationId, organizationId),
            eq(sprints.id, sprintId),
            isNull(sprints.discardedAt),
          ),
        )
    },
  }

  const sprintTaskRepository: SprintTaskRepository = {
    async listBySprint(organizationId, sprintId: SprintId) {
      const rows = await database
        .select()
        .from(sprintTasks)
        .where(
          and(eq(sprintTasks.organizationId, organizationId), eq(sprintTasks.sprintId, sprintId)),
        )
        .orderBy(asc(sprintTasks.addedAt), asc(sprintTasks.taskId))
      return rows.map(mapSprintTaskRow)
    },
    async listOpenByTasks(organizationId, taskIds: readonly TaskId[]) {
      if (taskIds.length === 0) return []
      const rows = await database
        .select()
        .from(sprintTasks)
        .where(
          and(
            eq(sprintTasks.organizationId, organizationId),
            inArray(sprintTasks.taskId, [...taskIds]),
            isNull(sprintTasks.removedAt),
          ),
        )
      return rows.map(mapSprintTaskRow)
    },
    async listByTask(organizationId, taskId) {
      const rows = await database
        .select()
        .from(sprintTasks)
        .where(and(eq(sprintTasks.organizationId, organizationId), eq(sprintTasks.taskId, taskId)))
        .orderBy(asc(sprintTasks.addedAt))
      return rows.map(mapSprintTaskRow)
    },
    async countOpenInNotClosed(organizationId) {
      const [row] = await database
        .select({ total: sql<number>`count(*)` })
        .from(sprintTasks)
        .innerJoin(sprints, eq(sprints.id, sprintTasks.sprintId))
        .where(
          and(
            eq(sprintTasks.organizationId, organizationId),
            isNull(sprintTasks.removedAt),
            ne(sprints.status, 'closed'),
            isNull(sprints.discardedAt),
          ),
        )
      return Number(row?.total ?? 0)
    },
    async saveRows(organizationId, requested) {
      // Linhas fechadas vêm antes das abertas: a troca de sprint fecha a antiga e abre a nova.
      const ordered = [...requested].sort(
        (a, b) => Number(a.removedAt === null) - Number(b.removedAt === null),
      )
      for (const row of ordered) {
        // Sprint e tarefa precisam ser da organização; o resto é recusado sem gravar.
        const [sprint] = await database
          .select({ id: sprints.id })
          .from(sprints)
          .where(and(eq(sprints.id, row.sprintId), eq(sprints.organizationId, organizationId)))
          .limit(1)
        const [task] = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, row.taskId), eq(tasks.organizationId, organizationId)))
          .limit(1)
        if (!sprint || !task) continue
        if (row.removedAt === null) {
          const open = await database
            .select()
            .from(sprintTasks)
            .where(
              and(
                eq(sprintTasks.organizationId, organizationId),
                eq(sprintTasks.taskId, row.taskId),
                isNull(sprintTasks.removedAt),
              ),
            )
          if (
            open.some((other) => other.sprintId !== row.sprintId || other.addedAt !== row.addedAt)
          )
            throw new ConflictError('Tarefa já tem uma sprint aberta')
        }
        const value = {
          organizationId,
          sprintId: row.sprintId,
          taskId: row.taskId,
          addedAt: row.addedAt,
          addedBy: row.addedBy,
          removedAt: row.removedAt,
          removedBy: row.removedBy,
          outcome: row.outcome,
        }
        await database
          .insert(sprintTasks)
          .values(value)
          .onConflictDoUpdate({
            target: [sprintTasks.sprintId, sprintTasks.taskId, sprintTasks.addedAt],
            set: { removedAt: value.removedAt, removedBy: value.removedBy, outcome: value.outcome },
            setWhere: eq(sprintTasks.organizationId, organizationId),
          })
      }
    },
  }

  return { sprints: sprintRepository, sprintTasks: sprintTaskRepository }
}
