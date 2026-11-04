import { NotFoundError } from '@agilebox/core'
import type { OrganizationId } from '@agilebox/core'
import type { AppDeps } from '../../deps'

export async function findTaskPrefix(
  deps: Pick<AppDeps, 'organizations'>,
  organizationId: OrganizationId,
): Promise<string> {
  const organization = await deps.organizations.findById(organizationId)
  if (!organization) throw new NotFoundError('Organização não encontrada')
  return organization.taskPrefix
}
