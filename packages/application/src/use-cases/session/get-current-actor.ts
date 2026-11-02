import type { TenantContext } from '@agilebox/core'
import type { CurrentSessionDto } from '@agilebox/contract'
import type { ActorSession } from '../../ports'
import { assertTenant } from '../tenant-scope'

export class GetCurrentActor {
  constructor(private readonly session: ActorSession) {}

  execute(ctx: TenantContext): CurrentSessionDto {
    const actor = this.session.get()
    assertTenant(ctx, actor)
    return actor
  }
}
