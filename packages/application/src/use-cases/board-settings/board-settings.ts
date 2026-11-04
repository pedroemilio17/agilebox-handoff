import {
  canManageBoardSettings,
  createBoardSettings,
  PermissionDeniedError,
  toBoardSettingsId,
  validateWipLimits,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { BoardSettingsDto, SetWipLimitsInput } from '@agilebox/contract'
import { toBoardSettingsDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export class GetBoardSettings {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<BoardSettingsDto> {
    const settings = await this.deps.boardSettings.findByOrganization(actor.organizationId)
    return toBoardSettingsDto(settings)
  }
}

/** Substitui os limites da organização. Limite é sinal, não bloqueio: não impede mover tarefas. */
export class SetWipLimits {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: SetWipLimitsInput): Promise<BoardSettingsDto> {
    if (!canManageBoardSettings(actor, actor.organizationId))
      throw new PermissionDeniedError('Só o gestor altera os limites de WIP')
    const wipLimits = validateWipLimits(input.wipLimits)
    const now = await this.deps.clock.now(actor.organizationId)
    const current = await this.deps.boardSettings.findByOrganization(actor.organizationId)
    const settings = createBoardSettings({
      id:
        current?.id ??
        toBoardSettingsId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      wipLimits,
      updatedAt: now,
      updatedBy: actor.userId,
    })
    await this.deps.unitOfWork.run(actor.organizationId, async ({ boardSettings }) => {
      await boardSettings.save(actor.organizationId, settings)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'board', ids: [] })
    return toBoardSettingsDto(settings)
  }
}
