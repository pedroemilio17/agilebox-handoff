import type { Organization, OrganizationId } from '@agilebox/core'

export interface OrganizationRepository {
  findById(organizationId: OrganizationId): Promise<Organization | null>
  save(organization: Organization): Promise<void>
}
