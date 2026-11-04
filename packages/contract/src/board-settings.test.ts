import { describe, expect, it } from 'vitest'
import {
  boardSettingsDtoSchema,
  listBoardOutputSchema,
  setWipLimitsInputSchema,
  wipColumnDtoSchema,
  wipLimitsSchema,
} from './index'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

describe('contrato de limites de WIP', () => {
  it('aceita limites de 1 a 99 nas colunas de WIP', () => {
    expect(wipLimitsSchema.parse({ in_progress: 1, review: 99 })).toEqual({
      in_progress: 1,
      review: 99,
    })
    expect(wipLimitsSchema.parse({})).toEqual({})
  })

  it('rejeita limite 0, 100 e fracionado', () => {
    expect(wipLimitsSchema.safeParse({ in_progress: 0 }).success).toBe(false)
    expect(wipLimitsSchema.safeParse({ review: 100 }).success).toBe(false)
    expect(wipLimitsSchema.safeParse({ review: 2.5 }).success).toBe(false)
  })

  it('rejeita limite em estado que não é de WIP', () => {
    for (const key of ['planning', 'todo', 'done']) {
      expect(wipLimitsSchema.safeParse({ [key]: 3 }).success).toBe(false)
      expect(setWipLimitsInputSchema.safeParse({ wipLimits: { [key]: 3 } }).success).toBe(false)
    }
  })

  it('descreve a configuração e a contagem de coluna', () => {
    expect(
      boardSettingsDtoSchema.parse({
        wipLimits: { review: 2 },
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: id,
      }),
    ).toMatchObject({ wipLimits: { review: 2 } })
    expect(
      wipColumnDtoSchema.parse({ status: 'in_progress', count: 4, limit: 3, state: 'over' }),
    ).toMatchObject({ state: 'over' })
    expect(
      wipColumnDtoSchema.safeParse({ status: 'todo', count: 1, limit: null, state: 'none' })
        .success,
    ).toBe(false)
  })

  it('o quadro devolve tarefas, limites e contagem por coluna', () => {
    expect(listBoardOutputSchema.parse({ tasks: [], wipLimits: {}, wipColumns: [] })).toEqual({
      tasks: [],
      wipLimits: {},
      wipColumns: [],
    })
    expect(listBoardOutputSchema.safeParse([]).success).toBe(false)
  })
})
