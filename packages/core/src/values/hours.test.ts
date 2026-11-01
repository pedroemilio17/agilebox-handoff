import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { formatHours, parseHours } from './hours'

describe('horas', () => {
  it.each([
    ['1,5', 150],
    ['1.5', 150],
    ['45', 4500],
    ['0,004', 0],
    ['0,005', 1],
    ['1,999', 200],
  ])('converte %s em centésimos', (input, expected) => {
    expect(parseHours(input)).toBe(expected)
  })
  it.each(['', ' ', '-1', '-0,001', 'abc', '1,2,3', '1e3', 'R$ 1', '90071992547410'])(
    'rejeita %s',
    (input) => {
      expect(() => parseHours(input)).toThrow(ValidationError)
    },
  )
  it('rejeita centésimos inválidos na formatação', () => {
    expect(() => formatHours(-1)).toThrow(ValidationError)
    expect(() => formatHours(1.5)).toThrow(ValidationError)
  })
  it.each([
    [0, '0 h'],
    [150, '1,5 h'],
    [101, '1,01 h'],
    [12300, '123 h'],
  ])('formata %i centésimos', (value, expected) => {
    expect(formatHours(value)).toBe(expected)
  })
})
