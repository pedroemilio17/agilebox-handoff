import { createContributor, toContributorId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ContributorDto, CreateContributorInput } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class CreateContributor {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CreateContributorInput): Promise<ContributorDto> {
    const contributor = createContributor({
      id: toContributorId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      name: input.name,
      source: 'manual',
      defaultRateCents: 0,
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(actor.organizationId),
    })
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.contributors.save(actor.organizationId, contributor)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'contributor',
      ids: [contributor.id],
    })
    return toContributorDto(contributor, actor)
  }
}
