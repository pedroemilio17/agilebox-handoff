import { describe, expect, it } from 'vitest'
import { createDailyEntry } from '../entities/daily-entry'
import type { DailyEntry } from '../entities/daily-entry'
import { ValidationError } from '../shared/errors'
import { toDailyEntryId, toOrganizationId, toUserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import { assertDailyDateNotFuture, hasDailyForDate, isDailyDue } from './daily'

function entryOn(date: string): DailyEntry {
  return createDailyEntry({
    id: toDailyEntryId(`01ARZ3NDEKTSV4RRFFQ69G5F${date.slice(-2)}`),
    organizationId: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW'),
    userId: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB0'),
    date,
    answers: { progress: 'Algo', nextStep: '', blocker: '' },
    noNews: false,
    taskRefs: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  })
}

describe('daily: datas e pendência', () => {
  it('detecta se há daily na data', () => {
    const entries = [entryOn('2026-11-03')]
    expect(hasDailyForDate(entries, parseDateOnly('2026-11-03'))).toBe(true)
    expect(hasDailyForDate(entries, parseDateOnly('2026-11-04'))).toBe(false)
  })

  it('é devida quando não há daily na data, e não é devida depois de preenchida', () => {
    expect(isDailyDue([], parseDateOnly('2026-11-04'))).toBe(true)
    expect(isDailyDue([entryOn('2026-11-03')], parseDateOnly('2026-11-04'))).toBe(true)
    expect(isDailyDue([entryOn('2026-11-04')], parseDateOnly('2026-11-04'))).toBe(false)
  })

  it('recusa data futura e aceita hoje e datas passadas', () => {
    const today = parseDateOnly('2026-11-04')
    expect(() => assertDailyDateNotFuture(parseDateOnly('2026-11-05'), today)).toThrow(
      ValidationError,
    )
    expect(() => assertDailyDateNotFuture(today, today)).not.toThrow()
    expect(() => assertDailyDateNotFuture(parseDateOnly('2026-11-03'), today)).not.toThrow()
  })
})
