import {
  canEditRate,
  createUser,
  NotFoundError,
  PermissionDeniedError,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { SetDefaultRateInput, UserDto } from '@agilebox/contract'
import { toUserDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class SetDefaultRate {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: SetDefaultRateInput): Promise<UserDto> {
    const userId = toUserId(input.userId)
    const user = await this.deps.users.findById(actor.organizationId, userId)
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
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.users.save(actor.organizationId, updated)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'user', ids: [user.id] })
    return toUserDto(updated, actor)
  }
}
