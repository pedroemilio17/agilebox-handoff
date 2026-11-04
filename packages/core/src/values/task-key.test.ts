import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { formatTaskKey, parseTaskKey, parseTaskNumber, parseTaskPrefix } from './task-key'

describe('chave legível da tarefa', () => {
  it('formata prefixo e número', () => {
    expect(formatTaskKey('AB', 118)).toBe('AB-118')
    expect(formatTaskKey('ABCDE', 1)).toBe('ABCDE-1')
  })
  it('faz o parse de uma chave válida', () => {
    expect(parseTaskKey('AB-118')).toEqual({ prefix: 'AB', number: 118 })
    expect(parseTaskKey('XYZ-7')).toEqual({ prefix: 'XYZ', number: 7 })
  })
  it.each([
    '',
    'AB',
    'AB-',
    '-118',
    'AB118',
    'AB-0',
    'AB-00',
    'AB-01',
    'AB--118',
    'AB-1.5',
    'AB-1a',
    'AB-118 ',
    ' AB-118',
    'ab-118',
    'Ab-118',
    'A-118',
    'ABCDEF-118',
    'AB1-118',
    'AB-9007199254740993',
    'AB-118\n',
  ])('parse inválido retorna null: %j', (value) => {
    expect(parseTaskKey(value)).toBeNull()
  })
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita número inválido na formatação: %s',
    (number) => {
      expect(() => formatTaskKey('AB', number)).toThrow(ValidationError)
      expect(() => parseTaskNumber(number)).toThrow(ValidationError)
    },
  )
  it.each(['', 'A', 'ABCDEF', 'ab', 'Ab', 'A1', 'AB-', ' AB'])(
    'rejeita prefixo inválido %j',
    (prefix) => {
      expect(() => formatTaskKey(prefix, 1)).toThrow(ValidationError)
      expect(() => parseTaskPrefix(prefix)).toThrow(ValidationError)
    },
  )
  it('aceita prefixo de 2 a 5 letras maiúsculas', () => {
    expect(parseTaskPrefix('AB')).toBe('AB')
    expect(parseTaskPrefix('ABCDE')).toBe('ABCDE')
  })
  it('ida e volta preserva prefixo e número', () => {
    expect(parseTaskKey(formatTaskKey('PROJ', 42))).toEqual({ prefix: 'PROJ', number: 42 })
  })
})
