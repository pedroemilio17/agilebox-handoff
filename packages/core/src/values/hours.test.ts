import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import {
  assertEstimatedHours,
  formatHours,
  MAX_ESTIMATED_HOURS,
  parseEstimatedHours,
  parseHours,
} from './hours'

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

describe('estimativa em horas (ADR-07)', () => {
  it.each([
    [null, null],
    [0, 0],
    [1, 1],
    [150, 150],
    [MAX_ESTIMATED_HOURS, MAX_ESTIMATED_HOURS],
  ])('aceita %s centésimos (nulo = sem estimativa)', (value, expected) => {
    expect(parseEstimatedHours(value)).toBe(expected)
  })

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    MAX_ESTIMATED_HOURS + 1,
  ])('recusa %s', (value) => {
    expect(() => parseEstimatedHours(value)).toThrow(ValidationError)
  })

  it('limite é 1000 horas, em centésimos', () => {
    expect(MAX_ESTIMATED_HOURS).toBe(100_000)
  })

  it('a entrada textual é convertida por parseHours (arredonda no terceiro decimal)', () => {
    expect(parseEstimatedHours(parseHours('2,345'))).toBe(235)
    expect(parseEstimatedHours(parseHours('2,349'))).toBe(235)
  })

  it('assertEstimatedHours aceita valor válido e recusa inválido (uso interno do custo)', () => {
    expect(assertEstimatedHours(10)).toBe(10)
    expect(() => assertEstimatedHours(-10)).toThrow(ValidationError)
  })

  it('normaliza -0 para 0, na entrada direta e pelo parse opcional', () => {
    expect(Object.is(assertEstimatedHours(-0), 0)).toBe(true)
    expect(Object.is(parseEstimatedHours(-0), 0)).toBe(true)
  })
})
