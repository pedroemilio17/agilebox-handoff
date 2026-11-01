import type { Actor } from '@agilebox/core'
import type { ContributorDto } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { ContributorRepository } from '../../ports'

export class ListContributors {
  constructor(private readonly contributors: ContributorRepository) {}

  async execute(actor: Actor): Promise<readonly ContributorDto[]> {
    const contributors = await this.contributors.list(actor.organizationId)
    return contributors.map((contributor) => toContributorDto(contributor, actor))
  }
}
