import { describe, expect, it } from 'vitest'
import { setEstimateInputSchema } from './estimates'
import { estimatedHoursSchema } from './shared-schemas'

const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

describe('horas estimadas', () => {
  it('aceita zero, decimais de até duas casas e o teto de 1000 h', () => {
    expect(estimatedHoursSchema.parse(0)).toBe(0)
    expect(estimatedHoursSchema.parse(1.5)).toBe(1.5)
    expect(estimatedHoursSchema.parse(0.01)).toBe(0.01)
    expect(estimatedHoursSchema.parse(1.1)).toBe(1.1)
    expect(estimatedHoursSchema.parse(1000)).toBe(1000)
  })

  it('recusa negativo, NaN, infinito, texto e acima de 1000 h', () => {
    for (const value of [-0.01, Number.NaN, Number.POSITIVE_INFINITY, '2', 1000.01]) {
      expect(estimatedHoursSchema.safeParse(value).success).toBe(false)
    }
  })

  it('recusa mais de duas casas decimais em vez de arredondar (a entrada é exata)', () => {
    expect(estimatedHoursSchema.safeParse(1.005).success).toBe(false)
    expect(estimatedHoursSchema.safeParse(0.333).success).toBe(false)
  })
})

describe('schema de entrada da estimativa', () => {
  it('define ou limpa a estimativa pelo id da tarefa', () => {
    expect(setEstimateInputSchema.parse({ taskId, estimatedHours: 3.5 })).toEqual({
      taskId,
      estimatedHours: 3.5,
    })
    expect(setEstimateInputSchema.parse({ taskId, estimatedHours: null })).toEqual({
      taskId,
      estimatedHours: null,
    })
  })

  it('recusa id malformado, campo ausente e valor fora da faixa', () => {
    expect(
      setEstimateInputSchema.safeParse({ taskId: 'tarefa-1', estimatedHours: 1 }).success,
    ).toBe(false)
    expect(setEstimateInputSchema.safeParse({ taskId }).success).toBe(false)
    expect(setEstimateInputSchema.safeParse({ taskId, estimatedHours: -1 }).success).toBe(false)
    expect(setEstimateInputSchema.safeParse({ taskId, estimatedHours: 1.234 }).success).toBe(false)
  })
})
