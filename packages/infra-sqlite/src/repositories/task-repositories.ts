import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { SQLWrapper } from 'drizzle-orm'
import { toTaskId } from '@agilebox/core'
import type {
  ParticipationRepository,
  TaskOpenRepository,
  TaskRepository,
  TimelineRepository,
} from '@agilebox/application'
import type {
  OrganizationId,
  Participation,
  Task,
  TaskId,
  TimelineEvent,
  UserId,
} from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapParticipationRow, mapTaskRow, mapTimelineEventRow } from '../mappers/task-mappers.js'
import {
  contributors,
  projects,
  taskEvents,
  taskOpens,
  taskParticipations,
  tasks,
  users,
} from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export function createSqliteTaskRepositories(database: SqliteDatabase): {
  readonly tasks: TaskRepository
  readonly participations: ParticipationRepository
  readonly timeline: TimelineRepository
  readonly taskOpens: TaskOpenRepository
} {
  async function findTaskRows(
    organizationId: OrganizationId,
    condition: SQLWrapper | undefined,
  ): Promise<readonly Task[]> {
    const baseCondition = condition
      ? and(eq(tasks.organizationId, organizationId), condition)
      : eq(tasks.organizationId, organizationId)
    const rows = await database
      .select({ task: tasks, projectName: projects.name })
      .from(tasks)
      .innerJoin(
        projects,
        and(eq(tasks.projectId, projects.id), eq(projects.organizationId, organizationId)),
      )
      .where(baseCondition)
    const mapped: Task[] = []
    for (const row of rows) {
      const participationRows = await database
        .select()
        .from(taskParticipations)
        .where(eq(taskParticipations.taskId, row.task.id))
      mapped.push(mapTaskRow(row.task, row.projectName, participationRows.map(mapParticipationRow)))
    }
    return mapped
  }

  async function taskIdsForUser(userId: UserId) {
    return database
      .select({ taskId: taskParticipations.taskId })
      .from(taskParticipations)
      .where(eq(taskParticipations.userId, userId))
  }

  async function participantBelongsToOrganization(
    organizationId: OrganizationId,
    participation: Participation,
  ): Promise<boolean> {
    const ownerTable = participation.participant.kind === 'user' ? users : contributors
    const ownerId =
      participation.participant.kind === 'user'
        ? participation.participant.userId
        : participation.participant.contributorId
    const [owner] = await database
      .select({ id: ownerTable.id })
      .from(ownerTable)
      .where(and(eq(ownerTable.id, ownerId), eq(ownerTable.organizationId, organizationId)))
      .limit(1)
    return owner !== undefined
  }

  const taskRepository: TaskRepository = {
    async findById(organizationId, taskId) {
      const [task] = await findTaskRows(organizationId, eq(tasks.id, taskId))
      return task ?? null
    },
    async findByProjectNameKey(organizationId, projectId, nameKey) {
      const project = await database
        .select({ name: projects.name })
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
        .limit(1)
      if (!project.length) return null
      const tasksInProject = await findTaskRows(organizationId, eq(tasks.projectId, projectId))
      return (
        tasksInProject.find(
          (task) =>
            task.title.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR') ===
            nameKey,
        ) ?? null
      )
    },
    async listByProject(organizationId, projectId) {
      const result = await findTaskRows(organizationId, eq(tasks.projectId, projectId))
      return [...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
    async listBoard(organizationId, query) {
      const filters = []
      if (query.projectId !== undefined) filters.push(eq(tasks.projectId, query.projectId))
      if (query.userId !== undefined) {
        const participationTaskIds = await taskIdsForUser(query.userId)
        filters.push(
          or(
            eq(tasks.createdBy, query.userId),
            inArray(
              tasks.id,
              participationTaskIds.length ? participationTaskIds.map((row) => row.taskId) : [''],
            ),
          )!,
        )
      }
      const result = await findTaskRows(
        organizationId,
        filters.length ? and(...filters) : undefined,
      )
      const order = ['planning', 'todo', 'in_progress', 'review', 'done']
      return [...result].sort(
        (a, b) =>
          order.indexOf(a.status) - order.indexOf(b.status) ||
          a.createdAt.localeCompare(b.createdAt),
      )
    },
    async listRecent(organizationId, userId) {
      const participationTaskIds = await taskIdsForUser(userId)
      const result = await findTaskRows(
        organizationId,
        or(
          eq(tasks.createdBy, userId),
          inArray(
            tasks.id,
            participationTaskIds.length ? participationTaskIds.map((row) => row.taskId) : [''],
          ),
        ),
      )
      return [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async listFrequent(organizationId, userId) {
      const opened = await database
        .select({ taskId: taskOpens.taskId, lastOpenedAt: taskOpens.lastOpenedAt })
        .from(taskOpens)
        .innerJoin(tasks, eq(taskOpens.taskId, tasks.id))
        .innerJoin(users, eq(taskOpens.userId, users.id))
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            eq(users.organizationId, organizationId),
            eq(taskOpens.userId, userId),
          ),
        )
        .orderBy(desc(taskOpens.lastOpenedAt), desc(taskOpens.openCount))
      const result: Task[] = []
      for (const row of opened) {
        const task = await taskRepository.findById(organizationId, toTaskId(row.taskId))
        if (
          task &&
          (task.createdBy === userId ||
            task.participations.some(
              (participation) =>
                participation.participant.kind === 'user' &&
                participation.participant.userId === userId,
            ))
        )
          result.push(task)
      }
      return result
    },
    async search(organizationId, query, userId) {
      const normalized = query
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLocaleLowerCase('pt-BR')
        .trim()
      if (!normalized) return []
      const participationTaskIds = await taskIdsForUser(userId)
      return findTaskRows(
        organizationId,
        and(
          like(tasks.searchText, `%${normalized}%`),
          or(
            eq(tasks.createdBy, userId),
            inArray(
              tasks.id,
              participationTaskIds.length ? participationTaskIds.map((row) => row.taskId) : [''],
            ),
          ),
        ),
      )
    },
    async count(organizationId) {
      const [row] = await database
        .select({ value: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.organizationId, organizationId))
      return Number(row?.value ?? 0)
    },
    async save(organizationId, task) {
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, task.projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      const [creator] = await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, task.createdBy), eq(users.organizationId, organizationId)))
        .limit(1)
      const validParticipants = await Promise.all(
        task.participations.map((participation) =>
          participantBelongsToOrganization(organizationId, participation),
        ),
      )
      if (!project || !creator || !validParticipants.every(Boolean)) return
      // Tarefa de outra organização com o mesmo id: não troca a linha nem mexe nas participações dela.
      const [owner] = await database
        .select({ organizationId: tasks.organizationId })
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .limit(1)
      if (owner && owner.organizationId !== organizationId) return
      const value = {
        id: task.id,
        organizationId,
        projectId: task.projectId,
        createdBy: task.createdBy,
        title: task.title,
        description: task.description,
        status: task.status,
        deadline: task.deadline,
        ticketId: task.ticket === null ? null : String(task.ticket.id),
        ticketUrl: task.ticket?.url ?? null,
        searchText: task.searchText,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        archivedAt: task.archivedAt,
      }
      await database
        .insert(tasks)
        .values(value)
        .onConflictDoUpdate({
          target: tasks.id,
          set: value,
          setWhere: eq(tasks.organizationId, organizationId),
        })
      await database.delete(taskParticipations).where(eq(taskParticipations.taskId, task.id))
      if (task.participations.length)
        await database.insert(taskParticipations).values(
          task.participations.map((participation) => ({
            id: participation.id,
            taskId: task.id,
            userId:
              participation.participant.kind === 'user' ? participation.participant.userId : null,
            contributorId:
              participation.participant.kind === 'contributor'
                ? participation.participant.contributorId
                : null,
            role: participation.role,
            hoursHundredths: participation.hoursHundredths,
            rateCents: participation.rateCents,
            addedAt: participation.addedAt,
          })),
        )
    },
  }

  const participationRepository: ParticipationRepository = {
    async findById(organizationId, participationId) {
      const [row] = await database
        .select({ participation: taskParticipations })
        .from(taskParticipations)
        .innerJoin(tasks, eq(taskParticipations.taskId, tasks.id))
        .where(
          and(eq(tasks.organizationId, organizationId), eq(taskParticipations.id, participationId)),
        )
        .limit(1)
      return row ? mapParticipationRow(row.participation) : null
    },
    async listByTask(organizationId, taskId) {
      const rows = await database
        .select({ participation: taskParticipations })
        .from(taskParticipations)
        .innerJoin(tasks, eq(taskParticipations.taskId, tasks.id))
        .where(and(eq(tasks.organizationId, organizationId), eq(taskParticipations.taskId, taskId)))
        .orderBy(asc(taskParticipations.addedAt), asc(taskParticipations.id))
      return rows.map((row) => mapParticipationRow(row.participation))
    },
    async save(organizationId, participation: Participation) {
      const [task] = await database
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, participation.taskId), eq(tasks.organizationId, organizationId)))
        .limit(1)
      if (!task) return
      if (!(await participantBelongsToOrganization(organizationId, participation))) return
      const value = {
        id: participation.id,
        taskId: participation.taskId,
        userId: participation.participant.kind === 'user' ? participation.participant.userId : null,
        contributorId:
          participation.participant.kind === 'contributor'
            ? participation.participant.contributorId
            : null,
        role: participation.role,
        hoursHundredths: participation.hoursHundredths,
        rateCents: participation.rateCents,
        addedAt: participation.addedAt,
      }
      await database
        .insert(taskParticipations)
        .values(value)
        .onConflictDoUpdate({
          target: taskParticipations.id,
          set: value,
          // A linha existente só é trocada se a tarefa dela também for da organização.
          setWhere: inArray(
            taskParticipations.taskId,
            database
              .select({ id: tasks.id })
              .from(tasks)
              .where(eq(tasks.organizationId, organizationId)),
          ),
        })
    },
    async count(organizationId) {
      const [row] = await database
        .select({ value: sql<number>`count(*)` })
        .from(taskParticipations)
        .innerJoin(tasks, eq(taskParticipations.taskId, tasks.id))
        .where(eq(tasks.organizationId, organizationId))
      return Number(row?.value ?? 0)
    },
    async remove(organizationId, participationId) {
      const taskIds = database
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.organizationId, organizationId))
      await database
        .delete(taskParticipations)
        .where(
          and(
            eq(taskParticipations.id, participationId),
            inArray(taskParticipations.taskId, taskIds),
          ),
        )
    },
  }

  const timelineRepository: TimelineRepository = {
    async listByTask(organizationId, taskId) {
      const rows = await database
        .select({ event: taskEvents })
        .from(taskEvents)
        .innerJoin(tasks, eq(taskEvents.taskId, tasks.id))
        .where(and(eq(tasks.organizationId, organizationId), eq(taskEvents.taskId, taskId)))
        .orderBy(desc(taskEvents.at), desc(taskEvents.id))
      return rows.map((row) => mapTimelineEventRow(row.event))
    },
    async saveMany(organizationId, events: readonly TimelineEvent[]) {
      for (const event of events) {
        const [task] = await database
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, event.taskId), eq(tasks.organizationId, organizationId)))
          .limit(1)
        const [actor] = await database
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, event.actorUserId), eq(users.organizationId, organizationId)))
          .limit(1)
        if (!task || !actor) continue
        await database
          .insert(taskEvents)
          .values({
            id: event.id,
            taskId: event.taskId,
            at: event.at,
            actorUserId: event.actorUserId,
            asManager: event.asManager,
            type: event.type,
            payload: JSON.stringify(event.payload),
          })
          .onConflictDoNothing()
      }
    },
  }

  const taskOpenRepository: TaskOpenRepository = {
    async recordOpen(organizationId, taskId: TaskId, userId: UserId, openedAt) {
      const [validTask] = await database
        .select({ id: tasks.id })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(users, eq(users.id, userId))
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.organizationId, organizationId),
            eq(projects.organizationId, organizationId),
            eq(users.organizationId, organizationId),
          ),
        )
        .limit(1)
      if (!validTask) return
      const value = { userId, taskId, lastOpenedAt: openedAt, openCount: 1 }
      await database
        .insert(taskOpens)
        .values(value)
        .onConflictDoUpdate({
          target: [taskOpens.userId, taskOpens.taskId],
          set: { lastOpenedAt: openedAt, openCount: sql`${taskOpens.openCount} + 1` },
        })
    },
  }

  return {
    tasks: taskRepository,
    participations: participationRepository,
    timeline: timelineRepository,
    taskOpens: taskOpenRepository,
  }
}
