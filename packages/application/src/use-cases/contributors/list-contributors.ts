import type { Actor, TenantContext } from '@agilebox/core'
import type { ContributorDto } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { ContributorRepository } from '../../ports'
import { assertTenant } from '../tenant-scope'

export class ListContributors {
  constructor(private readonly contributors: ContributorRepository) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly ContributorDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const contributors = await this.contributors.list(organizationId)
    return contributors.map((contributor) => toContributorDto(contributor, actor))
  }
}
