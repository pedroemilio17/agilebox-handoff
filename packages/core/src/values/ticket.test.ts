import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { createTicket } from './ticket'

describe('chamado', () => {
  it('aceita ID positivo sem link ou com link HTTP(S)', () => {
    expect(createTicket(1)).toEqual({ id: 1 })
    expect(createTicket(123, 'https://example.com/chamado/123')).toEqual({
      id: 123,
      url: 'https://example.com/chamado/123',
    })
    expect(createTicket(2, 'http://example.com')).toEqual({ id: 2, url: 'http://example.com' })
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita ID inválido %s',
    (id) => expect(() => createTicket(id)).toThrow(ValidationError),
  )

  it.each(['', 'example.com', '/caminho', 'ftp://example.com', 'javascript:alert(1)', 'https://'])(
    'rejeita link inválido %j',
    (url) => expect(() => createTicket(1, url)).toThrow(ValidationError),
  )
})
