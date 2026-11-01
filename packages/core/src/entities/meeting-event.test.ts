import { describe, expect, it } from 'vitest'
import { toEventId, toMeetingId, toOrganizationId, toTaskId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { createMeeting } from './meeting'
import { createTimelineEvent } from './timeline-event'
import type { TimelineEvent } from './timeline-event'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const userId = toUserId(id)
const base = {
  id: toEventId(id),
  taskId: toTaskId(id),
  actorUserId: userId,
  at: '2026-01-01T00:00:00Z',
  asManager: true,
}
const participant = { kind: 'user' as const, userId }

describe('eventos da linha do tempo', () => {
  it('constrói cada tipo com seu payload', () => {
    const events: TimelineEvent[] = [
      { ...base, type: 'task_created', payload: {} },
      { ...base, type: 'status_changed', payload: { before: 'todo', after: 'review' } },
      {
        ...base,
        type: 'deadline_changed',
        payload: { before: null, after: parseDateOnly('2026-01-01') },
      },
      { ...base, type: 'renamed', payload: { before: 'A', after: 'B' } },
      { ...base, type: 'description_edited', payload: { before: '', after: 'B' } },
      { ...base, type: 'responsible_changed', payload: { before: userId, after: userId } },
      { ...base, type: 'ticket_changed', payload: { before: null, after: { id: 1 } } },
      { ...base, type: 'hours_changed', payload: { participant, before: 0, after: 150 } },
      { ...base, type: 'rate_changed', payload: { participant, before: 100, after: 200 } },
      { ...base, type: 'participant_added', payload: { participant, role: 'support' } },
      { ...base, type: 'participant_removed', payload: { participant, role: 'support' } },
    ]
    for (const event of events) expect(createTimelineEvent(event)).toEqual(event)
  })
})

describe('agendamento', () => {
  const input = {
    id: toMeetingId(id),
    organizationId: toOrganizationId(id),
    title: ' Reunião ',
    date: parseDateOnly('2026-02-28'),
    time: '09:30',
    participants: [userId],
    createdBy: userId,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
  it('normaliza título e copia participantes', () => {
    const meeting = createMeeting(input)
    expect(meeting.title).toBe('Reunião')
    expect(meeting.participants).toEqual([userId])
    expect(meeting.participants).not.toBe(input.participants)
  })
  it.each(['', ' ', '24:00', '12:60', '9:30', '12:3', '12:30:00'])(
    'rejeita hora inválida %s',
    (time) => {
      expect(() => createMeeting({ ...input, time })).toThrow()
    },
  )
  it('rejeita título vazio e data inválida', () => {
    expect(() => createMeeting({ ...input, title: '  ' })).toThrow()
    expect(() => createMeeting({ ...input, date: '2026-02-30' as typeof input.date })).toThrow()
  })
})
