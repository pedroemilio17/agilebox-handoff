import type { Actor } from '@agilebox/core'
import type { SessionUserDto } from '@agilebox/contract'
import { toSessionUserDto } from '../../mappers'
import type { UserRepository } from '../../ports'

export class ListSessionUsers {
  constructor(private readonly users: UserRepository) {}

  async execute(actor: Actor): Promise<readonly SessionUserDto[]> {
    const users = await this.users.list(actor.organizationId)
    return users.map((user) => toSessionUserDto(user, actor))
  }
}
