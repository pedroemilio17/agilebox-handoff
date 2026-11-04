import { describe, expect, it } from 'vitest'
import { isWipStatus, parseWipLimitInput } from './wip-limit'

describe('parseWipLimitInput', () => {
  it('aceita inteiros de 1 a 99, ignorando espaços', () => {
    expect(parseWipLimitInput('1')).toBe(1)
    expect(parseWipLimitInput(' 99 ')).toBe(99)
    expect(parseWipLimitInput('3')).toBe(3)
  })

  it('recusa zero, acima de 99, vazio, texto e decimais', () => {
    for (const text of ['0', '100', '', '   ', 'abc', '2,5', '2.5', '-1', '1e2']) {
      expect(parseWipLimitInput(text), text).toBeNull()
    }
  })
})

describe('isWipStatus', () => {
  it('reconhece só Desenvolvendo e Revisar', () => {
    expect(isWipStatus('in_progress')).toBe(true)
    expect(isWipStatus('review')).toBe(true)
    expect(isWipStatus('todo')).toBe(false)
    expect(isWipStatus('done')).toBe(false)
  })
})
