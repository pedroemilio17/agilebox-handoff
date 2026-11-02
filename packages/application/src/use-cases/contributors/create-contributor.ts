import { createContributor, toContributorId } from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { ContributorDto, CreateContributorInput } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class CreateContributor {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: CreateContributorInput,
  ): Promise<ContributorDto> {
    const organizationId = assertTenant(ctx, actor)
    const contributor = createContributor({
      id: toContributorId(await this.deps.idGenerator.generate(organizationId)),
      organizationId,
      name: input.name,
      source: 'manual',
      defaultRateCents: 0,
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(organizationId),
    })
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      await repositories.contributors.save(organizationId, contributor)
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'contributor',
      ids: [contributor.id],
    })
    return toContributorDto(contributor, actor)
  }
}
