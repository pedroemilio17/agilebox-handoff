import {
  canEditRate,
  createUser,
  NotFoundError,
  PermissionDeniedError,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, TenantContext } from '@agilebox/core'
import type { SetDefaultRateInput, UserDto } from '@agilebox/contract'
import { toUserDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { assertTenant } from '../tenant-scope'

export class SetDefaultRate {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor, input: SetDefaultRateInput): Promise<UserDto> {
    const organizationId = assertTenant(ctx, actor)
    if (input.rateCents <= 0) {
      throw new ValidationError('Valor/hora padrão deve ser maior que zero')
    }
    const userId = toUserId(input.userId)
    const user = await this.deps.users.findById(organizationId, userId)
    if (!user) throw new NotFoundError('Usuário não encontrado')
    if (
      !canEditRate(actor, {
        organizationId: user.organizationId,
        participant: { kind: 'user', userId },
      })
    ) {
      throw new PermissionDeniedError('Sem permissão para alterar o valor/hora deste usuário')
    }
    const updated = createUser({ ...user, defaultRateCents: input.rateCents })
    await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      await repositories.users.save(organizationId, updated)
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'user', ids: [user.id] })
    return toUserDto(updated, actor)
  }
}
