import { describe, expect, it } from 'vitest'
import {
  getCurrentSessionOutputSchema,
  listSessionUsersOutputSchema,
  switchUserInputSchema,
} from './session'

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const organizationId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

describe('schemas de sessão', () => {
  it('aceita a troca para um usuário identificado por ULID', () => {
    expect(switchUserInputSchema.parse({ userId })).toEqual({ userId })
  })

  it('rejeita usuário com identificador inválido', () => {
    expect(switchUserInputSchema.safeParse({ userId: 'user-1' }).success).toBe(false)
  })

  it('aceita a sessão atual e os usuários disponíveis com valor ocultável', () => {
    const session = { userId, organizationId, role: 'manager' }
    const user = {
      id: userId,
      name: 'Ana Lima',
      initials: 'AL',
      role: 'collaborator',
      defaultRate: null,
    }

    expect(getCurrentSessionOutputSchema.parse(session)).toEqual(session)
    expect(listSessionUsersOutputSchema.parse([user])).toEqual([user])
  })

  it('rejeita papel desconhecido e valor/hora não numérico', () => {
    expect(
      getCurrentSessionOutputSchema.safeParse({ userId, organizationId, role: 'admin' }).success,
    ).toBe(false)
    expect(
      listSessionUsersOutputSchema.safeParse([
        { id: userId, name: 'Ana Lima', initials: 'AL', role: 'manager', defaultRate: '45' },
      ]).success,
    ).toBe(false)
  })
})
