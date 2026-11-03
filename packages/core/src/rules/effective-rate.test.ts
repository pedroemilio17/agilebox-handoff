import { describe, expect, it } from 'vitest'
import { createOrganization } from '../entities/organization'
import { createUser } from '../entities/user'
import { toOrganizationId, toUserId } from '../shared/ids'
import { effectiveRate } from './effective-rate'

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const createdAt = '2026-01-01T00:00:00.000Z'
const organization = createOrganization({
  id: toOrganizationId(id),
  name: 'Time',
  createdAt,
})
const user = (defaultRateCents: number | null) =>
  createUser({
    id: toUserId(id),
    organizationId: organization.id,
    name: 'Maria',
    email: 'maria@example.com',
    role: 'collaborator',
    defaultRateCents,
    createdAt,
  })

describe('valor/hora efetivo', () => {
  it('usa o valor próprio do usuário quando existe, sobrescrevendo o da organização', () => {
    expect(effectiveRate(user(6200), organization)).toBe(6200)
  })

  it('usa o padrão da organização quando o usuário não tem valor próprio (null)', () => {
    expect(effectiveRate(user(null), organization)).toBe(4500)
  })

  it('trata zero como valor próprio, não como ausência', () => {
    expect(effectiveRate(user(0), organization)).toBe(0)
  })
})
