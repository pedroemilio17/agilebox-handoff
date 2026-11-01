import type { Contributor, ContributorId, OrganizationId } from '@agilebox/core'

export interface ContributorRepository {
  findById(
    organizationId: OrganizationId,
    contributorId: ContributorId,
  ): Promise<Contributor | null>
  list(organizationId: OrganizationId): Promise<readonly Contributor[]>
  save(organizationId: OrganizationId, contributor: Contributor): Promise<void>
}
