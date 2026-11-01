import { describe, expect, it } from 'vitest'
import { setDefaultRateInputSchema, setDefaultRateOutputSchema } from './users'

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

describe('schemas de usuários', () => {
  it('aceita valor/hora positivo em centavos', () => {
    expect(setDefaultRateInputSchema.parse({ userId, rateCents: 4550 })).toEqual({
      userId,
      rateCents: 4550,
    })
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita valor/hora inválido: %s',
    (rateCents) => {
      expect(setDefaultRateInputSchema.safeParse({ userId, rateCents }).success).toBe(false)
    },
  )

  it('aceita DTO com valor/hora visível ou oculto', () => {
    const user = {
      id: userId,
      name: 'Ana Lima',
      email: 'ana@example.com',
      initials: 'AL',
      role: 'collaborator',
      defaultRate: 45.5,
    }
    expect(setDefaultRateOutputSchema.parse(user)).toEqual(user)
    expect(setDefaultRateOutputSchema.parse({ ...user, defaultRate: null }).defaultRate).toBeNull()
  })
})
