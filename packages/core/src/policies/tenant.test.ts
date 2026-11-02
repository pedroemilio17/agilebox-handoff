import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import type { OrganizationId, UserId } from '../shared/ids'
import type { Actor } from './actor'
import { createTenantContext } from './tenant'

const org = 'org' as OrganizationId
const user = 'user' as UserId
const actor: Actor = { userId: user, organizationId: org, role: 'collaborator' }

describe('createTenantContext', () => {
  it('embrulha o organizationId do ator, sem outros dados', () => {
    const ctx = createTenantContext({ ...actor, role: 'manager' })
    expect(ctx).toEqual({ organizationId: org })
    expect(Object.keys(ctx)).toEqual(['organizationId'])
  })

  it('o mesmo ator gera o mesmo time para gestor e colaborador', () => {
    expect(createTenantContext(actor)).toEqual(createTenantContext({ ...actor, role: 'manager' }))
  })

  it('recusa ator sem organizationId', () => {
    const semOrg = { userId: user, role: 'collaborator' } as unknown as Actor
    expect(() => createTenantContext(semOrg)).toThrow(ValidationError)
  })

  it('recusa organizationId vazio', () => {
    const vazio = { ...actor, organizationId: '' as OrganizationId }
    expect(() => createTenantContext(vazio)).toThrow(ValidationError)
  })

  it('recusa organizationId que não é texto', () => {
    const invalido = { ...actor, organizationId: 42 as unknown as OrganizationId }
    expect(() => createTenantContext(invalido)).toThrow(ValidationError)
  })
})
