import type { Participant } from '../entities/participation'
import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import { canSeeRate } from '../policies/access-policy'
import type { Actor } from '../policies/actor'
import type { ContributorId, OrganizationId, UserId } from '../shared/ids'
import { formatHours } from '../values/hours'
import { formatBRL } from '../values/money'
import { TASK_STATUS_LABELS } from '../values/task-status'
import type { Ticket } from '../values/ticket'

type Draft<T> = T extends TimelineEvent ? Pick<T, 'type' | 'payload'> : never
export type TimelineEventDraft = Draft<TimelineEvent>
export interface TimelineNames {
  readonly organizationId: OrganizationId
  readonly user: (id: UserId) => string
  readonly contributor: (id: ContributorId) => string
}

function key(participant: Participant): string {
  return participant.kind === 'user'
    ? `user:${participant.userId}`
    : `contributor:${participant.contributorId}`
}
function responsible(task: Task): UserId {
  const participant = task.participations.find((p) => p.role === 'responsible')?.participant
  if (!participant || participant.kind !== 'user') throw new Error('Tarefa sem responsável')
  return participant.userId
}
function sameTicket(a: Ticket | null, b: Ticket | null): boolean {
  return a === null || b === null ? a === b : a.id === b.id && a.url === b.url
}

export function diffTask(before: Task, after: Task): TimelineEventDraft[] {
  const events: TimelineEventDraft[] = []
  if (before.status !== after.status)
    events.push({ type: 'status_changed', payload: { before: before.status, after: after.status } })
  if (before.deadline !== after.deadline)
    events.push({
      type: 'deadline_changed',
      payload: { before: before.deadline, after: after.deadline },
    })
  if (before.title !== after.title)
    events.push({ type: 'renamed', payload: { before: before.title, after: after.title } })
  if (before.description !== after.description)
    events.push({
      type: 'description_edited',
      payload: { before: before.description, after: after.description },
    })
  if (before.archivedAt !== after.archivedAt)
    events.push({ type: after.archivedAt ? 'archived' : 'unarchived', payload: {} })
  const previousResponsible = responsible(before)
  const nextResponsible = responsible(after)
  if (previousResponsible !== nextResponsible)
    events.push({
      type: 'responsible_changed',
      payload: { before: previousResponsible, after: nextResponsible },
    })
  if (!sameTicket(before.ticket, after.ticket))
    events.push({ type: 'ticket_changed', payload: { before: before.ticket, after: after.ticket } })
  for (const previous of before.participations) {
    const next = after.participations.find((p) => key(p.participant) === key(previous.participant))
    if (!next)
      events.push({
        type: 'participant_removed',
        payload: { participant: previous.participant, role: previous.role },
      })
    else {
      if (previous.hoursHundredths !== next.hoursHundredths)
        events.push({
          type: 'hours_changed',
          payload: {
            participant: next.participant,
            before: previous.hoursHundredths,
            after: next.hoursHundredths,
          },
        })
      if (previous.rateCents !== next.rateCents)
        events.push({
          type: 'rate_changed',
          payload: {
            participant: next.participant,
            before: previous.rateCents,
            after: next.rateCents,
          },
        })
    }
  }
  for (const next of after.participations) {
    if (!before.participations.some((p) => key(p.participant) === key(next.participant)))
      events.push({
        type: 'participant_added',
        payload: { participant: next.participant, role: next.role },
      })
  }
  return events
}

export function describeEvent(event: TimelineEvent, viewer: Actor, names: TimelineNames): string {
  const name = (p: Participant) =>
    p.kind === 'user' ? names.user(p.userId) : names.contributor(p.contributorId)
  const ticket = (value: Ticket | null) =>
    value ? `#${value.id}${value.url ? ` (${value.url})` : ''}` : 'sem chamado'
  switch (event.type) {
    case 'progress_confirmed':
      return 'confirmou que a tarefa segue em andamento'
    case 'task_created':
      return 'criou a tarefa'
    case 'archived':
      return 'arquivou a tarefa'
    case 'unarchived':
      return 'desarquivou a tarefa'
    case 'moved_to_board':
      return 'levou a tarefa ao quadro'
    case 'sent_to_backlog':
      return 'devolveu a tarefa ao backlog'
    case 'status_changed':
      return `moveu de ${TASK_STATUS_LABELS[event.payload.before]} para ${TASK_STATUS_LABELS[event.payload.after]}`
    case 'deadline_changed':
      return `alterou o prazo de ${event.payload.before ?? 'sem prazo'} para ${event.payload.after ?? 'sem prazo'}`
    case 'renamed':
      return `renomeou de ${event.payload.before} para ${event.payload.after}`
    case 'description_edited':
      return 'editou a descrição'
    case 'responsible_changed':
      return `alterou o responsável de ${names.user(event.payload.before)} para ${names.user(event.payload.after)}`
    case 'ticket_changed':
      return `alterou o chamado de ${ticket(event.payload.before)} para ${ticket(event.payload.after)}`
    case 'hours_changed':
      return `alterou as horas de ${name(event.payload.participant)} de ${formatHours(event.payload.before)} para ${formatHours(event.payload.after)}`
    case 'rate_changed':
      return canSeeRate(viewer, {
        organizationId: names.organizationId,
        participant: event.payload.participant,
      })
        ? `alterou o valor/hora de ${name(event.payload.participant)} de ${formatBRL(event.payload.before)} para ${formatBRL(event.payload.after)}`
        : `alterou o valor/hora de ${name(event.payload.participant)}`
    case 'participant_added':
      return `adicionou ${name(event.payload.participant)} como ${event.payload.role === 'responsible' ? 'Responsável' : 'Apoio'}`
    case 'participant_removed':
      return `removeu ${name(event.payload.participant)} de ${event.payload.role === 'responsible' ? 'Responsável' : 'Apoio'}`
  }
}
