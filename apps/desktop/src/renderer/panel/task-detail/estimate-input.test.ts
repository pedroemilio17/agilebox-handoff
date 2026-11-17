import { describe, expect, it } from 'vitest'
import { parseEstimateInput } from './estimate-input'

describe('campo Estimativa (h)', () => {
  it('aceita número de 0 a 9999 com vírgula ou ponto, até 2 casas', () => {
    expect(parseEstimateInput('0')).toEqual({ ok: true, hours: 0 })
    expect(parseEstimateInput('1,5')).toEqual({ ok: true, hours: 1.5 })
    expect(parseEstimateInput('2.25')).toEqual({ ok: true, hours: 2.25 })
    expect(parseEstimateInput(' 9999 ')).toEqual({ ok: true, hours: 9999 })
  })

  it('vazio tira a estimativa', () => {
    expect(parseEstimateInput('   ')).toEqual({ ok: true, hours: null })
  })

  it('recusa acima de 9999, com mais de 2 casas, negativo e texto', () => {
    for (const text of ['10000', '9999,5', '1,234', '-1', 'abc', '1,', ',5', '1e3'])
      expect(parseEstimateInput(text), text).toEqual({ ok: false })
  })
})
