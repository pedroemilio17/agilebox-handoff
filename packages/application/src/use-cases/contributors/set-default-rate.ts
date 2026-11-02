import {
  canEditRate,
  createContributor,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toContributorId,
} from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { ContributorDto, SetContributorDefaultRateInput } from '@agilebox/contract'
import { toContributorDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class SetContributorDefaultRate {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: SetContributorDefaultRateInput,
  ): Promise<ContributorDto> {
    const organizationId = assertTenant(ctx, actor)
    if (input.rateCents <= 0) {
      throw new ValidationError('Valor/hora padrão deve ser maior que zero')
    }
    const contributorId = toContributorId(input.contributorId)
    const contributor = await this.deps.contributors.findById(organizationId, contributorId)
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
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      await repositories.contributors.save(organizationId, updated)
    })
    await this.deps.changeNotifier.publish(organizationId, {
      kind: 'contributor',
      ids: [updated.id],
    })
    return toContributorDto(updated, actor)
  }
}
