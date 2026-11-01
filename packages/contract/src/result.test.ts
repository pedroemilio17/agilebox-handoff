import { describe, expect, it } from 'vitest'
import { failureResult, successResult } from './result'

describe('envelope de resultado da API', () => {
  it('representa sucesso com o valor retornado', () => {
    expect(successResult({ id: 'task-1' })).toEqual({ ok: true, value: { id: 'task-1' } })
  })

  it('representa falha com código e mensagem da API', () => {
    expect(failureResult('FORBIDDEN', 'Acesso negado')).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Acesso negado' },
    })
  })
})
