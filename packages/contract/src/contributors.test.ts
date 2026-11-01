import { describe, expect, it } from 'vitest'
import {
  createContributorInputSchema,
  createContributorOutputSchema,
  listContributorsOutputSchema,
  setContributorDefaultRateInputSchema,
} from './contributors'

const contributorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

describe('schemas de entidades', () => {
  it('aceita criação e retorno de entidade stakeholder', () => {
    expect(createContributorInputSchema.parse({ name: 'Cliente Alfa' })).toEqual({
      name: 'Cliente Alfa',
    })
    const contributor = {
      id: contributorId,
      name: 'Cliente Alfa',
      defaultRate: null,
    }
    expect(createContributorOutputSchema.parse(contributor)).toEqual(contributor)
    expect(listContributorsOutputSchema.parse([contributor])).toEqual([contributor])
  })

  it('rejeita nome vazio, identificador inválido e valor/hora negativo', () => {
    expect(createContributorInputSchema.safeParse({ name: '' }).success).toBe(false)
    expect(
      setContributorDefaultRateInputSchema.safeParse({ contributorId: 'bad', rateCents: 4500 })
        .success,
    ).toBe(false)
    expect(
      setContributorDefaultRateInputSchema.safeParse({ contributorId, rateCents: -1 }).success,
    ).toBe(false)
  })
})
