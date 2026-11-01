import type { Actor } from '@agilebox/core'

export interface ActorSession {
  get(): Actor
  set(actor: Actor): void
}
