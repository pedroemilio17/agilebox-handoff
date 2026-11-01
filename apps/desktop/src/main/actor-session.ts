import { toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { ActorSession } from '@agilebox/application'
import type { UserRepository } from '@agilebox/application'

export interface ActorSessionSettings {
  get(key: string): string | undefined
  set(key: string, value: string): void
  getFirstOrganizationId(): Promise<Actor['organizationId'] | null>
}

const actorSettingKey = 'actor-user-id'

export async function createActorSession(
  userRepository: UserRepository,
  settings: ActorSessionSettings,
): Promise<ActorSession> {
  const saved = settings.get(actorSettingKey)
  const organizationId = await settings.getFirstOrganizationId()
  if (!organizationId) throw new Error('A organização inicial não foi criada')
  const allUsers = await userRepository.list(organizationId)
  const savedUser = saved ? await userRepository.findById(organizationId, toUserId(saved)) : null
  const user = savedUser ?? allUsers.find((entry) => entry.email === 'pedro@agilebox.demo')
  if (!user) throw new Error('O usuário padrão Pedro não foi encontrado')

  let actor: Actor = {
    userId: toUserId(user.id),
    organizationId: user.organizationId,
    role: user.role,
  }
  const session: ActorSession = {
    get: () => actor,
    set: (next) => {
      actor = next
      settings.set(actorSettingKey, next.userId)
    },
  }
  if (!saved) session.set(actor)
  return session
}
