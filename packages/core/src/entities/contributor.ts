import { ValidationError } from '../shared/errors'
import type { ContributorId, OrganizationId, UserId } from '../shared/ids'
import { validateDefaultRate, validateName } from './validation'

export interface Contributor {
  readonly id: ContributorId
  readonly organizationId: OrganizationId
  readonly name: string
  readonly source: 'manual' | 'azure'
  readonly externalId?: string
  readonly defaultRateCents: number
  readonly createdBy: UserId
  readonly createdAt: string
}

export function createContributor(input: Contributor): Contributor {
  const name = validateName(input.name)
  if (input.source !== 'manual' && input.source !== 'azure')
    throw new ValidationError('Origem de entidade inválida')
  validateDefaultRate(input.defaultRateCents)
  return {
    id: input.id,
    organizationId: input.organizationId,
    name,
    source: input.source,
    ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
    defaultRateCents: input.defaultRateCents,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  }
}
