import { describe, expect, it } from 'vitest'
import { parseEstimateInput } from './estimate-input'

describe('parseEstimateInput', () => {
  it('campo vazio limpa a estimativa', () => {
    expect(parseEstimateInput('   ')).toEqual({ ok: true, hours: null })
  })

  it.each([
    ['3', 3],
    ['2,5', 2.5],
    ['2.25', 2.25],
    [' 0 ', 0],
    ['0,01', 0.01],
    ['1000', 1000],
  ])('aceita "%s" como %s horas', (text, hours) => {
    expect(parseEstimateInput(text)).toEqual({ ok: true, hours })
  })

  it.each(['-1', '1001', '1000,01', '1,234', 'abc', '1,2,3', '1e2', '1 h'])(
    'recusa "%s" com a mensagem do campo',
    (text) => {
      expect(parseEstimateInput(text)).toEqual({
        ok: false,
        message: 'Use um número de 0 a 1000, com até duas casas decimais.',
      })
    },
  )
})
