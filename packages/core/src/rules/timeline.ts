import type { Participant } from '../entities/participation'
import type { Task } from '../entities/task'
import type { TaskSprintTimelineEvent, TimelineEvent } from '../entities/timeline-event'
import { sprintLabel } from '../entities/sprint'
import { canSeeRate } from '../policies/access-policy'
import type { Actor } from '../policies/actor'
import type { ContributorId, DeliverableId, OrganizationId, UserId } from '../shared/ids'
import { formatHours } from '../values/hours'
import { formatBRL } from '../values/money'
import { TASK_PRIORITY_LABELS } from '../values/task-priority'
import { TASK_STATUS_LABELS } from '../values/task-status'
import type { Ticket } from '../values/ticket'

type Draft<T> = T extends TimelineEvent ? Pick<T, 'type' | 'payload'> : never
export type TimelineEventDraft = Draft<TimelineEvent>
/** Rascunho de entrada/saída de sprint (ver TaskSprintTimelineEvent). */
export type TaskSprintEventDraft = Pick<TaskSprintTimelineEvent, 'type' | 'payload'>
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

/**
 * Eventos das mudanças da tarefa. `resolution` é a nota de resolução quando a mudança desbloqueia
 * (M5.2a): vai no evento `unblocked`.
 */
export function diffTask(
  before: Task,
  after: Task,
  resolution: string | null = null,
): TimelineEventDraft[] {
  const events: TimelineEventDraft[] = []
  if (before.status !== after.status)
    events.push({ type: 'status_changed', payload: { before: before.status, after: after.status } })
  if (before.priority !== after.priority)
    events.push({
      type: 'priority_changed',
      payload: { before: before.priority, after: after.priority },
    })
  if (before.blockedReason !== after.blockedReason) {
    if (after.blockedReason !== null)
      events.push({ type: 'blocked', payload: { reason: after.blockedReason } })
    else if (before.blockedReason !== null)
      events.push({
        type: 'unblocked',
        payload:
          resolution === null
            ? { reason: before.blockedReason }
            : { reason: before.blockedReason, resolution },
      })
  }
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
  const previousResponsible = responsible(before)
  const nextResponsible = responsible(after)
  if (previousResponsible !== nextResponsible)
    events.push({
      type: 'responsible_changed',
      payload: { before: previousResponsible, after: nextResponsible },
    })
  if (!sameTicket(before.ticket, after.ticket))
    events.push({ type: 'ticket_changed', payload: { before: before.ticket, after: after.ticket } })
  if (before.estimatedHoursHundredths !== after.estimatedHoursHundredths)
    events.push({
      type: 'estimate_changed',
      payload: { before: before.estimatedHoursHundredths, after: after.estimatedHoursHundredths },
    })
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

/**
 * Mudança de entrega da tarefa (ADR-10). Nulo nos dois lados não é mudança: devolve nulo. Guarda o
 * título de cada lado, para a linha do tempo continuar legível depois de renomear ou remover.
 */
export function deliverableChangeDraft(
  before: { readonly id: DeliverableId; readonly title: string } | null,
  after: { readonly id: DeliverableId; readonly title: string } | null,
): TimelineEventDraft | null {
  if ((before?.id ?? null) === (after?.id ?? null)) return null
  return {
    type: 'deliverable_changed',
    payload: {
      before: before?.id ?? null,
      after: after?.id ?? null,
      beforeTitle: before?.title ?? null,
      afterTitle: after?.title ?? null,
    },
  }
}

/** Estimativa em centésimos para o texto da linha do tempo ("2 h") ou "sem estimativa". */
function estimateText(hundredths: number | null): string {
  return hundredths === null ? 'sem estimativa' : formatHours(hundredths)
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
    case 'status_changed':
      return `moveu de ${TASK_STATUS_LABELS[event.payload.before]} para ${TASK_STATUS_LABELS[event.payload.after]}`
    case 'priority_changed':
      return `alterou a prioridade de ${TASK_PRIORITY_LABELS[event.payload.before]} para ${TASK_PRIORITY_LABELS[event.payload.after]}`
    case 'checklist_item_added':
      return `adicionou a subtarefa: ${event.payload.title}`
    case 'checklist_item_done':
      return `concluiu a subtarefa: ${event.payload.title}`
    case 'checklist_item_reopened':
      return `reabriu a subtarefa: ${event.payload.title}`
    case 'checklist_item_removed':
      return `removeu a subtarefa: ${event.payload.title}`
    case 'definition_confirmed':
      return `concluiu a tarefa confirmando a definição de pronto (${event.payload.count === 1 ? '1 item' : `${event.payload.count} itens`})`
    case 'acceptance_criterion_added':
      return `adicionou o critério: ${event.payload.text}`
    case 'acceptance_criterion_removed':
      return `removeu o critério: ${event.payload.text}`
    case 'acceptance_criterion_done':
      return `marcou o critério como atendido: ${event.payload.text}`
    case 'acceptance_criterion_reopened':
      return `desmarcou o critério: ${event.payload.text}`
    case 'acceptance_criterion_renamed':
      return `renomeou o critério de "${event.payload.before}" para "${event.payload.after}"`
    case 'acceptance_criterion_moved':
      return `reordenou o critério "${event.payload.text}" para a posição ${event.payload.after + 1}`
    case 'estimate_changed':
      return `alterou a estimativa de ${estimateText(event.payload.before)} para ${estimateText(event.payload.after)}`
    case 'comment_added':
      return 'comentou na tarefa'
    case 'comment_removed':
      return 'removeu um comentário'
    case 'task_archived':
      return 'arquivou a tarefa'
    case 'task_unarchived':
      return 'desarquivou a tarefa'
    case 'task_added_to_backlog':
      return 'adicionou a tarefa ao backlog'
    case 'task_sent_to_backlog':
      return 'devolveu a tarefa ao backlog'
    case 'task_pulled_from_backlog':
      return `puxou a tarefa do backlog para ${TASK_STATUS_LABELS[event.payload.status]}`
    case 'task_reordered':
      return `reordenou a tarefa no backlog (posição ${event.payload.position})`
    case 'task_added_to_sprint':
      return `adicionou a tarefa à ${sprintLabel(event.payload.sprintNumber)}`
    case 'task_removed_from_sprint':
      return `removeu a tarefa da ${sprintLabel(event.payload.sprintNumber)}`
    case 'blocked':
      return `bloqueou a tarefa: ${event.payload.reason}`
    case 'unblocked':
      return event.payload.resolution
        ? `desbloqueou a tarefa: ${event.payload.resolution}`
        : 'desbloqueou a tarefa'
    case 'impediment_assigned': {
      const { before, after } = event.payload
      if (after === null) return 'removeu o responsável pelo impedimento'
      if (before === null) return `definiu ${names.user(after)} como responsável pelo impedimento`
      return `alterou o responsável pelo impedimento de ${names.user(before)} para ${names.user(after)}`
    }
    case 'deliverable_changed': {
      const { beforeTitle, afterTitle } = event.payload
      if (afterTitle === null) return `removeu a tarefa da entrega "${beforeTitle ?? ''}"`
      if (beforeTitle === null) return `ligou a tarefa à entrega "${afterTitle}"`
      return `mudou a tarefa da entrega "${beforeTitle}" para "${afterTitle}"`
    }
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
