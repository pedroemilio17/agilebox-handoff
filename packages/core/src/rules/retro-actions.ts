import { expandMeetingOccurrences } from './meeting-occurrences'
import type { Meeting } from '../entities/meeting'
import { createRetroAction } from '../entities/retro-action'
import type { RetroAction } from '../entities/retro-action'
import { validateRetroActionTitle } from '../entities/validation'
import { ValidationError } from '../shared/errors'
import type { MeetingId, RetroActionId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/** Limite de combinados por ocorrência de uma Retro. */
export const RETRO_ACTIONS_MAX_PER_OCCURRENCE = 30

export interface RetroActionCount {
  readonly meetingId: MeetingId
  readonly occurrenceDate: DateOnly
  readonly total: number
  readonly done: number
}

/** Chave de uma ocorrência (agendamento + data), usada para contagens. */
export function retroOccurrenceKey(meetingId: MeetingId, occurrenceDate: DateOnly): string {
  return `${meetingId}|${occurrenceDate}`
}

/** Só agendamentos do tipo Retro têm combinados, e só em datas que são ocorrências deles. */
export function isRetroOccurrence(meeting: Meeting, occurrenceDate: DateOnly): boolean {
  return (
    meeting.kind === 'retro' &&
    expandMeetingOccurrences([meeting], occurrenceDate, occurrenceDate).length > 0
  )
}

export function assertRetroOccurrence(meeting: Meeting, occurrenceDate: DateOnly): void {
  if (meeting.kind !== 'retro')
    throw new ValidationError('Só agendamentos do tipo Retro aceitam combinados')
  if (!isRetroOccurrence(meeting, occurrenceDate))
    throw new ValidationError('Data não é uma ocorrência deste agendamento')
}

export interface RetroActionDraft {
  readonly id: RetroActionId
  readonly occurrenceDate: string
  readonly title: string
  readonly responsibleId: UserId | null
  readonly dueDate: string | null
  readonly createdBy: UserId
  readonly createdAt: string
}

/**
 * Novo combinado da ocorrência. `existing` são os combinados já cadastrados nela.
 * O responsável é validado na aplicação (existe como usuário da organização).
 */
export function addRetroAction(
  meeting: Meeting,
  existing: readonly RetroAction[],
  draft: RetroActionDraft,
): RetroAction {
  const occurrenceDate = parseDateOnly(draft.occurrenceDate)
  assertRetroOccurrence(meeting, occurrenceDate)
  const sameOccurrence = existing.filter(
    (action) => action.meetingId === meeting.id && action.occurrenceDate === occurrenceDate,
  )
  if (sameOccurrence.length >= RETRO_ACTIONS_MAX_PER_OCCURRENCE)
    throw new ValidationError(
      `Limite de ${RETRO_ACTIONS_MAX_PER_OCCURRENCE} combinados por ocorrência`,
    )
  return createRetroAction({
    id: draft.id,
    organizationId: meeting.organizationId,
    meetingId: meeting.id,
    occurrenceDate,
    title: draft.title,
    responsibleId: draft.responsibleId,
    dueDate: draft.dueDate === null ? null : parseDateOnly(draft.dueDate),
    done: false,
    doneAt: null,
    createdAt: draft.createdAt,
    createdBy: draft.createdBy,
  })
}

export function renameRetroAction(action: RetroAction, title: string): RetroAction {
  const next = validateRetroActionTitle(title)
  return next === action.title ? action : { ...action, title: next }
}

export function changeRetroActionResponsible(
  action: RetroAction,
  responsibleId: UserId | null,
): RetroAction {
  return responsibleId === action.responsibleId ? action : { ...action, responsibleId }
}

export function changeRetroActionDueDate(action: RetroAction, dueDate: string | null): RetroAction {
  return createRetroAction({
    ...action,
    dueDate: dueDate === null ? null : parseDateOnly(dueDate),
  })
}

export function setRetroActionDone(action: RetroAction, done: boolean, at: string): RetroAction {
  if (action.done === done) return action
  return { ...action, done, doneAt: done ? at : null }
}

/** Contagens por ocorrência (total e concluídos). Ocorrências sem combinados não aparecem. */
export function countRetroActions(actions: readonly RetroAction[]): RetroActionCount[] {
  const counts = new Map<string, RetroActionCount>()
  for (const action of actions) {
    const key = retroOccurrenceKey(action.meetingId, action.occurrenceDate)
    const current = counts.get(key) ?? {
      meetingId: action.meetingId,
      occurrenceDate: action.occurrenceDate,
      total: 0,
      done: 0,
    }
    counts.set(key, {
      ...current,
      total: current.total + 1,
      done: current.done + (action.done ? 1 : 0),
    })
  }
  return [...counts.values()]
}
