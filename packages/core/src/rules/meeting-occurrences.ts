import { effectiveEndTime, UNBOUNDED_SERIES_WEEKS } from '../entities/meeting'
import type { Meeting } from '../entities/meeting'
import { ValidationError } from '../shared/errors'
import type { MeetingId } from '../shared/ids'
import { addDays, compareDateOnly, diffInDays } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

export interface MeetingOccurrence {
  /** Id do agendamento que originou a série (igual ao id do agendamento). */
  readonly seriesId: MeetingId
  /** Posição na série, a partir de 0 (0 também para avulsos). */
  readonly index: number
  readonly date: DateOnly
  readonly time: string
  /** Hora de fim efetiva (fim informado ou início + 1 hora). */
  readonly endTime: string
  readonly meeting: Meeting
}

/**
 * Gera as ocorrências de agendamentos avulsos e de séries semanais dentro de
 * [rangeStart, rangeEnd] (inclusive). Séries sem data limite vão até 52 semanas
 * depois do início. Edição e exclusão de uma série afetam todas as ocorrências:
 * não há exceções por ocorrência nesta fase.
 */
export function expandMeetingOccurrences(
  meetings: readonly Meeting[],
  rangeStart: DateOnly,
  rangeEnd: DateOnly,
): MeetingOccurrence[] {
  if (compareDateOnly(rangeEnd, rangeStart) < 0)
    throw new ValidationError('Intervalo de datas inválido')
  const occurrences: MeetingOccurrence[] = []
  for (const meeting of meetings) {
    const endTime = effectiveEndTime(meeting)
    const lastDate =
      meeting.recurrence === 'weekly'
        ? (meeting.recurrenceUntil ?? addDays(meeting.date, UNBOUNDED_SERIES_WEEKS * 7))
        : meeting.date
    if (compareDateOnly(meeting.date, rangeEnd) > 0) continue
    if (compareDateOnly(lastDate, rangeStart) < 0) continue
    const push = (index: number, date: DateOnly) =>
      occurrences.push({
        seriesId: meeting.id,
        index,
        date,
        time: meeting.time,
        endTime,
        meeting,
      })
    if (meeting.recurrence === 'none') {
      push(0, meeting.date)
      continue
    }
    // Primeira ocorrência da série que cai em ou depois do início da janela.
    const firstIndex = Math.max(0, Math.ceil(diffInDays(meeting.date, rangeStart) / 7))
    for (let index = firstIndex; ; index++) {
      const date = addDays(meeting.date, index * 7)
      if (compareDateOnly(date, rangeEnd) > 0 || compareDateOnly(date, lastDate) > 0) break
      push(index, date)
    }
  }
  return occurrences.sort(
    (a, b) =>
      compareDateOnly(a.date, b.date) ||
      a.time.localeCompare(b.time) ||
      a.seriesId.localeCompare(b.seriesId) ||
      a.index - b.index,
  )
}
