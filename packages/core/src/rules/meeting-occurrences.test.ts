import { describe, expect, it } from 'vitest'
import { createMeeting } from '../entities/meeting'
import type { Meeting } from '../entities/meeting'
import { ValidationError } from '../shared/errors'
import { toMeetingId, toOrganizationId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { expandMeetingOccurrences } from './meeting-occurrences'

const orgId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const userId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAW')

interface MeetingFixture {
  id: string
  date: string
  time?: string
  endTime?: string | null
  recurrence?: Meeting['recurrence']
  recurrenceUntil?: string | null
}

function meeting({
  id,
  date,
  time = '09:00',
  endTime = null,
  recurrence = 'none',
  recurrenceUntil = null,
}: MeetingFixture): Meeting {
  return createMeeting({
    id: toMeetingId(id),
    organizationId: orgId,
    title: 'Reunião',
    date: parseDateOnly(date),
    time,
    endTime,
    kind: 'meeting',
    recurrence,
    recurrenceUntil: recurrenceUntil === null ? null : parseDateOnly(recurrenceUntil),
    participants: [userId],
    createdBy: userId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  })
}

function dates(meetings: readonly Meeting[], start: string, end: string): DateOnly[] {
  return expandMeetingOccurrences(meetings, parseDateOnly(start), parseDateOnly(end)).map(
    (occurrence) => occurrence.date,
  )
}

describe('expansão de ocorrências', () => {
  it('gera avulsos e séries ordenados por data e hora', () => {
    const weekly = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-11-02',
      time: '09:00',
      recurrence: 'weekly',
    })
    const single = meeting({ id: '01ARZ3NDEKTSV4RRFFQ69G5FB2', date: '2026-11-03', time: '08:00' })
    const sameDay = meeting({ id: '01ARZ3NDEKTSV4RRFFQ69G5FB3', date: '2026-11-03', time: '10:00' })
    const occurrences = expandMeetingOccurrences(
      [sameDay, single, weekly],
      parseDateOnly('2026-11-01'),
      parseDateOnly('2026-11-04'),
    )
    expect(occurrences.map((item) => [item.date, item.time, item.seriesId])).toEqual([
      ['2026-11-02', '09:00', weekly.id],
      ['2026-11-03', '08:00', single.id],
      ['2026-11-03', '10:00', sameDay.id],
    ])
  })

  it('informa série, índice, data, fim efetivo e agendamento de cada ocorrência', () => {
    const weekly = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-11-02',
      time: '14:30',
      recurrence: 'weekly',
    })
    const [first] = expandMeetingOccurrences(
      [weekly],
      parseDateOnly('2026-11-02'),
      parseDateOnly('2026-11-02'),
    )
    expect(first).toMatchObject({
      seriesId: weekly.id,
      index: 0,
      date: '2026-11-02',
      time: '14:30',
      endTime: '15:30',
      meeting: weekly,
    })
  })

  it('atravessa virada de mês e de ano sem pular semanas', () => {
    const series = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-12-29',
      recurrence: 'weekly',
    })
    expect(dates([series], '2026-12-01', '2027-01-31')).toEqual([
      '2026-12-29',
      '2027-01-05',
      '2027-01-12',
      '2027-01-19',
      '2027-01-26',
    ])
  })

  it('respeita ano bissexto e ano comum', () => {
    const leap = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2028-02-22',
      recurrence: 'weekly',
    })
    expect(dates([leap], '2028-02-01', '2028-03-07')).toEqual([
      '2028-02-22',
      '2028-02-29',
      '2028-03-07',
    ])
    const common = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB2',
      date: '2027-02-22',
      recurrence: 'weekly',
    })
    expect(dates([common], '2027-02-01', '2027-03-07')).toEqual(['2027-02-22', '2027-03-01'])
  })

  it('inclui a data limite da série (até é inclusivo)', () => {
    const series = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-11-02',
      recurrence: 'weekly',
      recurrenceUntil: '2026-11-16',
    })
    expect(dates([series], '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ])
  })

  it('não gera ocorrência fora da janela nem depois da data limite', () => {
    const series = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-11-02',
      recurrence: 'weekly',
      recurrenceUntil: '2026-11-30',
    })
    expect(dates([series], '2026-12-01', '2026-12-31')).toEqual([])
    expect(dates([series], '2026-11-20', '2026-11-30')).toEqual(['2026-11-23', '2026-11-30'])
  })

  it('retorna lista vazia quando a janela não tem ocorrências', () => {
    const single = meeting({ id: '01ARZ3NDEKTSV4RRFFQ69G5FB2', date: '2026-11-03' })
    expect(dates([single], '2026-11-04', '2026-11-30')).toEqual([])
    expect(dates([], '2026-11-01', '2026-11-30')).toEqual([])
  })

  it('série sem data limite vai até 52 semanas depois do início', () => {
    const series = meeting({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
      date: '2026-11-02',
      recurrence: 'weekly',
    })
    const occurrences = expandMeetingOccurrences(
      [series],
      parseDateOnly('2027-10-25'),
      parseDateOnly('2027-12-31'),
    )
    expect(occurrences.map((item) => [item.date, item.index])).toEqual([
      ['2027-10-25', 51],
      ['2027-11-01', 52],
    ])
  })

  it('a janela deve começar antes ou no dia em que termina', () => {
    expect(() =>
      expandMeetingOccurrences([], parseDateOnly('2026-11-10'), parseDateOnly('2026-11-01')),
    ).toThrow(ValidationError)
  })
})
