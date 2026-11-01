import { ValidationError } from '../shared/errors'

export type UserRole = 'collaborator' | 'manager'
export type ParticipationRole = 'responsible' | 'support'

export function isUserRole(value: string): value is UserRole {
  return value === 'collaborator' || value === 'manager'
}

export function parseUserRole(value: string): UserRole {
  if (!isUserRole(value)) {
    throw new ValidationError('Papel de usuário inválido')
  }
  return value
}

export function isParticipationRole(value: string): value is ParticipationRole {
  return value === 'responsible' || value === 'support'
}

export function parseParticipationRole(value: string): ParticipationRole {
  if (!isParticipationRole(value)) {
    throw new ValidationError('Papel de participação inválido')
  }
  return value
}
