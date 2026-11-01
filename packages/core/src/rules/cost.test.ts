import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { parseHours } from '../values/hours'
import { parseMoney } from '../values/money'
import { subtotal, total } from './cost'

describe('custo', () => {
  it.each([
    ['1,5', '45,50', 6825],
    ['1.5', '45', 6750],
    ['0,01', '0,50', 1],
    ['0,01', '0,49', 0],
    ['0', '45', 0],
  ])('calcula %s horas a %s', (hours, rate, expected) => {
    expect(subtotal(parseHours(hours), parseMoney(rate))).toBe(expected)
  })

  it('soma subtotais arredondados individualmente', () => {
    expect(
      total([
        { hoursHundredths: 1, rateCents: 50 },
        { hoursHundredths: 1, rateCents: 50 },
      ]),
    ).toBe(2)
    expect(total([])).toBe(0)
  })

  it('rejeita valores inválidos e resultados inseguros', () => {
    expect(() => subtotal(-1, 100)).toThrow(ValidationError)
    expect(() => subtotal(1, -100)).toThrow(ValidationError)
    expect(() => subtotal(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toThrow(
      ValidationError,
    )
  })
})
