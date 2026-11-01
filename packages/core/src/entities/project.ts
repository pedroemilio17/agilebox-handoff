import type { OrganizationId, ProjectId, UserId } from '../shared/ids'
import { validateName } from './validation'

export interface Project {
  readonly id: ProjectId
  readonly organizationId: OrganizationId
  readonly name: string
  readonly nameKey: string
  readonly createdBy: UserId
  readonly createdAt: string
}

export function createProject(input: Omit<Project, 'nameKey'>): Project {
  const name = validateName(input.name)
  const nameKey = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
  return {
    id: input.id,
    organizationId: input.organizationId,
    name,
    nameKey,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  }
}
