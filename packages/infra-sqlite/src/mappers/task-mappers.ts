import {
  createParticipation,
  parseDateOnly,
  parseTaskStatus,
  toContributorId,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Participation, Task, TimelineEvent } from '@agilebox/core'
import { createTicket } from '@agilebox/core'
import type { taskEvents, taskParticipations, tasks } from '../schema/index.js'

type TaskRow = typeof tasks.$inferSelect
type ParticipationRow = typeof taskParticipations.$inferSelect
type EventRow = typeof taskEvents.$inferSelect

export function mapParticipationRow(row: ParticipationRow): Participation {
  const participant = row.userId
    ? { kind: 'user' as const, userId: toUserId(row.userId) }
    : row.contributorId
      ? { kind: 'contributor' as const, contributorId: toContributorId(row.contributorId) }
      : null
  if (!participant) throw new Error('Envolvimento sem participante')
  return createParticipation({
    id: toParticipationId(row.id),
    taskId: toTaskId(row.taskId),
    participant,
    role: row.role,
    hoursHundredths: row.hoursHundredths,
    rateCents: row.rateCents,
    addedAt: row.addedAt,
  })
}

export function mapTaskRow(
  row: TaskRow,
  projectName: string,
  participations: readonly Participation[],
): Task {
  return {
    id: toTaskId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    projectName,
    createdBy: toUserId(row.createdBy),
    title: row.title,
    description: row.description,
    status: parseTaskStatus(row.status),
    deadline: row.deadline === null ? null : parseDateOnly(row.deadline),
    ticket:
      row.ticketId === null ? null : createTicket(Number(row.ticketId), row.ticketUrl ?? undefined),
    searchText: row.searchText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    // Persistência de backlogRank/onBoard vem na M3.9; até lá toda tarefa está no quadro.
    backlogRank: null,
    onBoard: true,
    participations,
  }
}

export function mapTimelineEventRow(row: EventRow): TimelineEvent {
  return {
    id: toEventId(row.id),
    taskId: toTaskId(row.taskId),
    at: row.at,
    actorUserId: toUserId(row.actorUserId),
    asManager: row.asManager,
    type: row.type as TimelineEvent['type'],
    payload: JSON.parse(row.payload) as TimelineEvent['payload'],
  } as TimelineEvent
}
