import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { compareDateOnly, diffInDays, isDateOnly, parseDateOnly, toDateOnly } from './date-only'

describe('data sem hora', () => {
  it.each(['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31'])('aceita %s', (value) => {
    expect(isDateOnly(value)).toBe(true)
    expect(parseDateOnly(value)).toBe(value)
  })

  it.each([
    '',
    '2023-02-29',
    '1900-02-29',
    '2024-04-31',
    '2024-00-01',
    '2024-13-01',
    '0000-01-01',
    '2024-1-01',
    '2024-01-01 ',
    '2024-01-00',
  ])('rejeita %j', (value) => {
    expect(isDateOnly(value)).toBe(false)
    expect(() => parseDateOnly(value)).toThrow(ValidationError)
  })

  it('compara em ordem cronológica', () => {
    const first = parseDateOnly('2024-12-31')
    const second = parseDateOnly('2025-01-01')
    expect(compareDateOnly(first, second)).toBe(-1)
    expect(compareDateOnly(second, first)).toBe(1)
    expect(compareDateOnly(first, first)).toBe(0)
  })

  it.each([
    ['2024-01-31', '2024-02-01', 1],
    ['2024-02-28', '2024-03-01', 2],
    ['2023-02-28', '2023-03-01', 1],
    ['2024-12-31', '2025-01-01', 1],
    ['2025-01-01', '2024-12-31', -1],
    ['0001-01-01', '0001-01-01', 0],
  ])('calcula dias de %s até %s', (a, b, days) => {
    expect(diffInDays(parseDateOnly(a), parseDateOnly(b))).toBe(days)
  })

  it('obtém a data do instante no fuso indicado, inclusive na virada de ano', () => {
    const instant = new Date('2025-01-01T01:30:00.000Z')
    expect(toDateOnly(instant, 'UTC')).toBe('2025-01-01')
    expect(toDateOnly(instant, 'America/Cuiaba')).toBe('2024-12-31')
    expect(toDateOnly(new Date('2024-02-29T23:30:00Z'), 'Asia/Tokyo')).toBe('2024-03-01')
  })

  it('rejeita instante e fuso inválidos', () => {
    expect(() => toDateOnly(new Date('invalid'), 'UTC')).toThrow(ValidationError)
    expect(() => toDateOnly(new Date('2024-01-01T00:00:00Z'), 'invalid')).toThrow(ValidationError)
  })
})
