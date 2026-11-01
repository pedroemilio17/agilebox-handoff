import { describe, expect, it } from 'vitest'
import { todayDateOnly } from './today'

describe('todayDateOnly', () => {
  it('usa o dia do fuso local, com zeros à esquerda', () => {
    expect(todayDateOnly(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayDateOnly(new Date(2026, 10, 1, 0, 0))).toBe('2026-11-01')
  })
})
