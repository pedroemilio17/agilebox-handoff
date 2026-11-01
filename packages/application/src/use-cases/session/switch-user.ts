import { NotFoundError, toUserId } from '@agilebox/core'
import type { SwitchUserInput, CurrentSessionDto } from '@agilebox/contract'
import type { ActorSession, ChangeNotifier, UserRepository } from '../../ports'

export class SwitchUser {
  constructor(
    private readonly session: ActorSession,
    private readonly users: UserRepository,
    private readonly changeNotifier: ChangeNotifier,
  ) {}

  async execute(input: SwitchUserInput): Promise<CurrentSessionDto> {
    const current = this.session.get()
    const user = await this.users.findById(current.organizationId, toUserId(input.userId))
    if (!user) throw new NotFoundError('Usuário não encontrado')
    const actor = { userId: user.id, organizationId: user.organizationId, role: user.role }
    this.session.set(actor)
    await this.changeNotifier.publish(current.organizationId, { kind: 'session', ids: [user.id] })
    return actor
  }
}
