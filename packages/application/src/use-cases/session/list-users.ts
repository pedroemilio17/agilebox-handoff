import type { Actor, TenantContext } from '@agilebox/core'
import type { SessionUserDto } from '@agilebox/contract'
import { toSessionUserDto } from '../../mappers'
import type { UserRepository } from '../../ports'
import { assertTenant } from '../tenant-scope'

export class ListSessionUsers {
  constructor(private readonly users: UserRepository) {}

  async execute(ctx: TenantContext, actor: Actor): Promise<readonly SessionUserDto[]> {
    const organizationId = assertTenant(ctx, actor)
    const users = await this.users.list(organizationId)
    return users.map((user) => toSessionUserDto(user, actor))
  }
}
