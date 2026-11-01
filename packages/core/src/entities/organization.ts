import type { OrganizationId } from '../shared/ids'
import { validateName } from './validation'

export interface Organization {
  readonly id: OrganizationId
  readonly name: string
  readonly createdAt: string
}

export function createOrganization(input: Organization): Organization {
  return { id: input.id, name: validateName(input.name), createdAt: input.createdAt }
}
