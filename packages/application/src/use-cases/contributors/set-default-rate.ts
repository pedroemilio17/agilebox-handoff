import {
  canEditRate,
  createContributor,
  NotFoundError,
  PermissionDeniedError,
  toContributorId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ContributorDto, SetContributorDefaultRateInput } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class SetContributorDefaultRate {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: SetContributorDefaultRateInput): Promise<ContributorDto> {
    const contributorId = toContributorId(input.contributorId)
    const contributor = await this.deps.contributors.findById(actor.organizationId, contributorId)
    if (!contributor) throw new NotFoundError('Entidade não encontrada')
    if (
      !canEditRate(actor, {
        organizationId: contributor.organizationId,
        participant: { kind: 'contributor', contributorId },
      })
    ) {
      throw new PermissionDeniedError('Sem permissão para alterar o valor/hora desta entidade')
    }
    const updated = createContributor({ ...contributor, defaultRateCents: input.rateCents })
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.contributors.save(actor.organizationId, updated)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'contributor',
      ids: [updated.id],
    })
    return toContributorDto(updated, actor)
  }
}
