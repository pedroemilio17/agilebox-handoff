import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toMeetingId, toOrganizationId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { createMeeting, effectiveEndTime } from './meeting'
import type { Meeting } from './meeting'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const userId = toUserId(id)
const base: Meeting = {
  id: toMeetingId(id),
  organizationId: toOrganizationId(id),
  title: 'Alinhamento',
  date: parseDateOnly('2026-11-02'),
  time: '09:00',
  endTime: '10:00',
  kind: 'meeting',
  recurrence: 'weekly',
  recurrenceUntil: parseDateOnly('2026-12-31'),
  participants: [userId],
  createdBy: userId,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
}

describe('validação de agendamento', () => {
  it('aceita fim depois do início e data limite igual ao início', () => {
    expect(createMeeting(base)).toMatchObject({ endTime: '10:00', recurrenceUntil: '2026-12-31' })
    expect(
      createMeeting({ ...base, recurrenceUntil: parseDateOnly('2026-11-02') }).recurrenceUntil,
    ).toBe('2026-11-02')
  })

  it('rejeita fim igual ou anterior ao início e fim com formato inválido', () => {
    expect(() => createMeeting({ ...base, endTime: '09:00' })).toThrow(ValidationError)
    expect(() => createMeeting({ ...base, endTime: '08:30' })).toThrow(ValidationError)
    expect(() => createMeeting({ ...base, endTime: '9:30' })).toThrow(ValidationError)
    expect(() => createMeeting({ ...base, endTime: '24:00' })).toThrow(ValidationError)
  })

  it('rejeita data limite anterior ao início', () => {
    expect(() => createMeeting({ ...base, recurrenceUntil: parseDateOnly('2026-11-01') })).toThrow(
      'Data limite anterior ao início',
    )
  })

  it('descarta a data limite quando não há repetição', () => {
    expect(
      createMeeting({ ...base, recurrence: 'none', recurrenceUntil: parseDateOnly('2026-11-01') })
        .recurrenceUntil,
    ).toBeNull()
  })

  it('rejeita tipo e repetição fora dos valores previstos', () => {
    expect(() => createMeeting({ ...base, kind: 'prazo' as Meeting['kind'] })).toThrow(
      ValidationError,
    )
    expect(() => createMeeting({ ...base, recurrence: 'daily' as Meeting['recurrence'] })).toThrow(
      ValidationError,
    )
  })

  it('calcula a hora de fim efetiva: 1 hora sem fim, sem passar de 23:59', () => {
    expect(effectiveEndTime({ time: '14:30', endTime: null })).toBe('15:30')
    expect(effectiveEndTime({ time: '14:30', endTime: '16:00' })).toBe('16:00')
    expect(effectiveEndTime({ time: '23:30', endTime: null })).toBe('23:59')
  })
})
