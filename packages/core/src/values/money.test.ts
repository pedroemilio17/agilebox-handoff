import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { formatBRL, parseMoney, sumMoney } from './money'

describe('dinheiro', () => {
  it.each([
    ['45,50', 4550],
    ['45', 4500],
    ['45.5', 4550],
    ['R$ 45,50', 4550],
    ['0,004', 0],
    ['0,005', 1],
    ['1,999', 200],
    ['  12,345  ', 1235],
  ])('converte %s em centavos', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', ' ', '-1', '-0,001', 'abc', '1,2,3', '1.2.3', 'R$', '1e3', '90071992547410'])(
    'rejeita %s',
    (input) => {
      expect(() => parseMoney(input)).toThrow(ValidationError)
    },
  )

  it('soma centavos e rejeita valores inválidos ou soma insegura', () => {
    expect(sumMoney(100, 255, 0)).toBe(355)
    expect(() => sumMoney(-1)).toThrow(ValidationError)
    expect(() => sumMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow(ValidationError)
    expect(() => formatBRL(1.5)).toThrow(ValidationError)
  })

  it.each([
    [0, 'R$ 0,00'],
    [4550, 'R$ 45,50'],
    [123456, 'R$ 1.234,56'],
  ])('formata %i centavos', (value, expected) => {
    expect(formatBRL(value)).toBe(expected)
  })
})
