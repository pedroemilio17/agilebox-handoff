import { describe, expect, it } from 'vitest'
import { addDays, buildCalendarGrid, monthKey, shiftMonth } from './calendar-grid'

describe('grade do calendário', () => {
  it('tem 6 semanas começando no domingo, com dias de fora do mês', () => {
    const grid = buildCalendarGrid(2026, 10, '2026-11-01') // novembro de 2026 começa num domingo
    expect(grid).toHaveLength(42)
    expect(grid[0]).toMatchObject({ date: '2026-11-01', day: 1, inMonth: true, isToday: true })
    expect(grid[29]).toMatchObject({ date: '2026-11-30', inMonth: true })
    expect(grid[30]).toMatchObject({ date: '2026-12-01', inMonth: false })
  })

  it('mês que não começa no domingo traz dias do mês anterior', () => {
    const grid = buildCalendarGrid(2026, 9, '2026-11-01') // outubro de 2026 começa numa quinta
    expect(grid[0]).toMatchObject({ date: '2026-09-27', inMonth: false })
    expect(grid[4]).toMatchObject({ date: '2026-10-01', inMonth: true })
    expect(grid.filter((cell) => cell.isToday)).toHaveLength(1)
  })

  it.each([
    [2026, 1, 28], // fevereiro de 2026
    [2028, 1, 29], // fevereiro bissexto
    [2026, 3, 30],
    [2026, 11, 31],
  ])('mês %i/%i tem %i dias', (year, monthIndex, days) => {
    const inMonth = buildCalendarGrid(year, monthIndex, '2000-01-01').filter((cell) => cell.inMonth)
    expect(inMonth).toHaveLength(days)
  })

  it('vira o ano nos dois sentidos', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
    expect(shiftMonth(2026, 5, 18)).toEqual({ year: 2027, monthIndex: 11 })
    const january = buildCalendarGrid(2027, 0, '2027-01-01')
    expect(january[0]!.date.startsWith('2026-12')).toBe(true)
  })

  it('soma dias atravessando mês e ano e monta a chave do mês', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(monthKey(2026, 0)).toBe('2026-01')
  })
})
