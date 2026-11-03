import type { OrganizationId } from '../shared/ids'
import { validateDefaultRate, validateName } from './validation'

/** Padrão global de valor/hora da organização: R$ 45,00. */
export const DEFAULT_ORGANIZATION_RATE_CENTS = 4500

export interface Organization {
  readonly id: OrganizationId
  readonly name: string
  /** Valor/hora padrão da organização, em centavos. */
  readonly defaultRateCents: number
  readonly createdAt: string
}

export function createOrganization(
  input: Omit<Organization, 'name' | 'defaultRateCents'> & {
    readonly name: string
    readonly defaultRateCents?: number
  },
): Organization {
  const defaultRateCents = input.defaultRateCents ?? DEFAULT_ORGANIZATION_RATE_CENTS
  validateDefaultRate(defaultRateCents)
  return {
    id: input.id,
    name: validateName(input.name),
    defaultRateCents,
    createdAt: input.createdAt,
  }
}
