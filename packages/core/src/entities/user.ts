import type { OrganizationId, UserId } from '../shared/ids'
import { parseUserRole } from '../values/role'
import type { UserRole } from '../values/role'
import { validateDefaultRate, validateName } from './validation'

export interface User {
  readonly id: UserId
  readonly organizationId: OrganizationId
  readonly name: string
  readonly email: string
  readonly initials: string
  readonly role: UserRole
  readonly defaultRateCents: number
  readonly createdAt: string
}

export function createUser(input: Omit<User, 'initials'>): User {
  const name = validateName(input.name)
  const words = name.split(/\s+/u)
  const initials = (
    words[0]![0]! + (words.length > 1 ? words[words.length - 1]![0]! : '')
  ).toLocaleUpperCase('pt-BR')
  validateDefaultRate(input.defaultRateCents)
  return {
    id: input.id,
    organizationId: input.organizationId,
    name,
    email: input.email,
    initials,
    role: parseUserRole(input.role),
    defaultRateCents: input.defaultRateCents,
    createdAt: input.createdAt,
  }
}
