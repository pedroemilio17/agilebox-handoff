import type { CurrentSessionDto } from '@agilebox/contract'
import type { ActorSession } from '../../ports'

export class GetCurrentActor {
  constructor(private readonly session: ActorSession) {}

  execute(): CurrentSessionDto {
    return this.session.get()
  }
}
