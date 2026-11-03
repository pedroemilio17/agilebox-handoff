import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId } from '../shared/ids'
import { createOrganization } from './organization'

const input = {
  id: toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
  name: ' Time ',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('organização: valor/hora padrão', () => {
  it('usa R$ 45,00 (4500 centavos) quando não informado', () => {
    expect(createOrganization(input).defaultRateCents).toBe(4500)
  })

  it('aceita o valor informado', () => {
    expect(createOrganization({ ...input, defaultRateCents: 6000 }).defaultRateCents).toBe(6000)
  })

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita valor padrão inválido %s',
    (defaultRateCents) => {
      expect(() => createOrganization({ ...input, defaultRateCents })).toThrow(ValidationError)
    },
  )
})
