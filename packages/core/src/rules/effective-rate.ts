import type { Organization } from '../entities/organization'
import type { User } from '../entities/user'

/**
 * Valor/hora efetivo de um usuário, em centavos. O valor próprio do usuário, quando existe, sobrescreve
 * o padrão da organização; `null` usa o padrão da organização.
 */
export function effectiveRate(
  user: Pick<User, 'defaultRateCents'>,
  organization: Pick<Organization, 'defaultRateCents'>,
): number {
  return user.defaultRateCents ?? organization.defaultRateCents
}
