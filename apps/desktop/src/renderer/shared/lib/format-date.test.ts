import { describe, expect, it } from 'vitest'
import { formatDate, formatRelativeDate } from './format-date'

describe('formatação de data', () => {
  it('formata a data curta em português do Brasil', () => {
    expect(formatDate(new Date(2026, 10, 5, 12))).toBe('Qui, 05 nov')
  })

  it('formata o tempo relativo em português do Brasil', () => {
    const now = new Date('2026-11-05T12:12:00.000Z')

    expect(formatRelativeDate(new Date('2026-11-05T12:00:00.000Z'), now)).toBe('há 12 min')
  })
})
