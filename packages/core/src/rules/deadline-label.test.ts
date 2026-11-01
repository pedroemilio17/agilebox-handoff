import { describe, expect, it } from 'vitest'
import { parseDateOnly } from '../values/date-only'
import { deadlineLabel } from './deadline-label'

const today = parseDateOnly('2024-12-31')
describe('frases de prazo', () => {
  it.each([
    ['2024-12-29', 'Venceu há 2 dias'],
    ['2024-12-30', 'Venceu há 1 dia'],
    ['2024-12-31', 'Vence hoje'],
    ['2025-01-01', 'Vence amanhã'],
    ['2025-01-02', 'Em 2 dias'],
  ])('prazo %s: %s', (date, label) => {
    expect(deadlineLabel('todo', parseDateOnly(date), today)).toBe(label)
  })
  it('prioriza a conclusão mesmo com prazo vencido ou ausente', () => {
    expect(deadlineLabel('done', parseDateOnly('2024-01-01'), today)).toBe('Concluída')
    expect(deadlineLabel('done', null, today)).toBe('Concluída')
    expect(deadlineLabel('todo', null, today)).toBe('Sem prazo definido')
  })
})
