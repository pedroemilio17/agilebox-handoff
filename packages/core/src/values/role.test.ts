import { describe, expect, expectTypeOf, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { isParticipationRole, isUserRole, parseParticipationRole, parseUserRole } from './role'
import type { ParticipationRole, UserRole } from './role'

describe('papéis', () => {
  it.each(['collaborator', 'manager'])('aceita papel de usuário %s', (role) => {
    expect(isUserRole(role)).toBe(true)
    expect(parseUserRole(role)).toBe(role)
  })

  it.each(['responsible', 'support'])('aceita papel de participação %s', (role) => {
    expect(isParticipationRole(role)).toBe(true)
    expect(parseParticipationRole(role)).toBe(role)
  })

  it.each(['', 'manager ', 'MANAGER', 'support'])('rejeita papel de usuário %j', (role) => {
    expect(isUserRole(role)).toBe(false)
    expect(() => parseUserRole(role)).toThrow(ValidationError)
  })

  it.each(['', 'responsible ', 'SUPPORT', 'manager'])(
    'rejeita papel de participação %j',
    (role) => {
      expect(isParticipationRole(role)).toBe(false)
      expect(() => parseParticipationRole(role)).toThrow(ValidationError)
    },
  )

  it('expõe as uniões de papéis', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<'collaborator' | 'manager'>()
    expectTypeOf<ParticipationRole>().toEqualTypeOf<'responsible' | 'support'>()
  })
})
