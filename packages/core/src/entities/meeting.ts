import { ValidationError } from '../shared/errors'
import type { MeetingId, OrganizationId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { validateName } from './validation'

export const MEETING_KINDS = ['meeting', 'review', 'retro'] as const
export type MeetingKind = (typeof MEETING_KINDS)[number]

export const MEETING_RECURRENCES = ['none', 'weekly'] as const
export type MeetingRecurrence = (typeof MEETING_RECURRENCES)[number]

/** Sem hora de fim, o agendamento dura 1 hora (decisão D6). */
export const DEFAULT_MEETING_DURATION_MINUTES = 60

/**
 * Série sem data final: as ocorrências vão até 52 semanas depois do início.
 * Limite da expansão, não regra de negócio sobre o fim da série.
 */
export const UNBOUNDED_SERIES_WEEKS = 52

export interface Meeting {
  readonly id: MeetingId
  readonly organizationId: OrganizationId
  readonly title: string
  /** Início da série (ou data da ocorrência, se avulso). */
  readonly date: DateOnly
  readonly time: string
  /** 'HH:mm', maior que `time`, no mesmo dia. Null = sem fim (vale 1 hora). */
  readonly endTime: string | null
  readonly kind: MeetingKind
  readonly recurrence: MeetingRecurrence
  /** Data inclusiva da última ocorrência. Só existe com repetição semanal. */
  readonly recurrenceUntil: DateOnly | null
  readonly participants: readonly UserId[]
  readonly createdBy: UserId
  readonly createdAt: string
  readonly updatedAt: string
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function validateTime(time: string): string {
  if (!TIME_PATTERN.test(time)) throw new ValidationError('Hora inválida')
  return time
}

/**
 * Hora de fim efetiva de uma ocorrência: o fim informado ou início + 1 hora.
 * Não passa de 23:59, para não atravessar a meia-noite.
 */
export function effectiveEndTime(meeting: Pick<Meeting, 'time' | 'endTime'>): string {
  if (meeting.endTime) return meeting.endTime
  const [hours, minutes] = meeting.time.split(':').map(Number) as [number, number]
  const total = Math.min(hours * 60 + minutes + DEFAULT_MEETING_DURATION_MINUTES, 23 * 60 + 59)
  const endHours = String(Math.floor(total / 60)).padStart(2, '0')
  const endMinutes = String(total % 60).padStart(2, '0')
  return `${endHours}:${endMinutes}`
}

export function createMeeting(input: Meeting): Meeting {
  const title = validateName(input.title)
  const date = parseDateOnly(input.date)
  const time = validateTime(input.time)
  const endTime = input.endTime === null ? null : validateTime(input.endTime)
  if (endTime !== null && endTime <= time)
    throw new ValidationError('Fim deve ser depois do início')
  if (!MEETING_KINDS.includes(input.kind)) throw new ValidationError('Tipo de agendamento inválido')
  if (!MEETING_RECURRENCES.includes(input.recurrence))
    throw new ValidationError('Repetição inválida')
  // Sem repetição, a data limite não tem efeito e é descartada.
  const recurrenceUntil =
    input.recurrence === 'weekly' && input.recurrenceUntil !== null
      ? parseDateOnly(input.recurrenceUntil)
      : null
  if (recurrenceUntil !== null && recurrenceUntil < date)
    throw new ValidationError('Data limite anterior ao início')
  return {
    ...input,
    title,
    date,
    time,
    endTime,
    recurrenceUntil,
    participants: [...input.participants],
  }
}
