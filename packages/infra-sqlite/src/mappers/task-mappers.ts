import {
  createParticipation,
  parseDateOnly,
  toDeliverableId,
  parseTaskPriority,
  parseTaskStatus,
  toContributorId,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import {
  createChecklistItem,
  createTaskComment,
  toChecklistItemId,
  toTaskCommentId,
} from '@agilebox/core'
import type { ChecklistItem, Participation, Task, TaskComment, TimelineEvent } from '@agilebox/core'
import { createTicket } from '@agilebox/core'
import { createAcceptanceCriterion, toAcceptanceCriterionId } from '@agilebox/core'
import type { AcceptanceCriterion } from '@agilebox/core'
import type {
  taskAcceptanceCriteria,
  taskChecklistItems,
  taskComments,
  taskEvents,
  taskParticipations,
  tasks,
} from '../schema/index.js'

type AcceptanceRow = typeof taskAcceptanceCriteria.$inferSelect

type TaskRow = typeof tasks.$inferSelect
type ParticipationRow = typeof taskParticipations.$inferSelect
type EventRow = typeof taskEvents.$inferSelect
type ChecklistRow = typeof taskChecklistItems.$inferSelect
type CommentRow = typeof taskComments.$inferSelect

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
    number: row.number,
    projectId: toProjectId(row.projectId),
    projectName,
    createdBy: toUserId(row.createdBy),
    title: row.title,
    description: row.description,
    status: parseTaskStatus(row.status),
    priority: parseTaskPriority(row.priority),
    blockedReason: row.blockedReason ?? null,
    blockedAt: row.blockedAt ?? null,
    archivedAt: row.archivedAt ?? null,
    archivedBy:
      row.archivedBy === null || row.archivedBy === undefined ? null : toUserId(row.archivedBy),
    backlogRank: row.backlogRank ?? null,
    estimatedHoursHundredths: row.estimatedHoursHundredths ?? null,
    deliverableId: row.deliverableId ? toDeliverableId(row.deliverableId) : null,
    startsOn: row.startsOn ? parseDateOnly(row.startsOn) : null,
    deadline: row.deadline === null ? null : parseDateOnly(row.deadline),
    ticket:
      row.ticketId === null ? null : createTicket(Number(row.ticketId), row.ticketUrl ?? undefined),
    searchText: row.searchText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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

export function mapChecklistItemRow(row: ChecklistRow): ChecklistItem {
  return createChecklistItem({
    id: toChecklistItemId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    taskId: toTaskId(row.taskId),
    title: row.title,
    done: row.done,
    position: row.position,
    createdAt: row.createdAt,
    doneAt: row.doneAt ?? null,
  })
}

export function mapAcceptanceCriterionRow(row: AcceptanceRow): AcceptanceCriterion {
  return createAcceptanceCriterion({
    id: toAcceptanceCriterionId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    taskId: toTaskId(row.taskId),
    text: row.text,
    done: row.done,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

export function mapTaskCommentRow(row: CommentRow): TaskComment {
  const mentions = JSON.parse(row.mentions) as string[]
  return createTaskComment({
    id: toTaskCommentId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    taskId: toTaskId(row.taskId),
    authorId: toUserId(row.authorId),
    body: row.body,
    mentions: mentions.map(toUserId),
    createdAt: row.createdAt,
    editedAt: row.editedAt ?? null,
    asManager: row.asManager,
  })
}
