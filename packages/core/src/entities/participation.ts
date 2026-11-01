import { ValidationError } from '../shared/errors'
import type { ContributorId, ParticipationId, TaskId, UserId } from '../shared/ids'
import { validateHundredths } from '../values/decimal'
import { parseParticipationRole } from '../values/role'
import type { ParticipationRole } from '../values/role'

export type Participant =
  | { readonly kind: 'user'; readonly userId: UserId }
  | { readonly kind: 'contributor'; readonly contributorId: ContributorId }

export interface Participation {
  readonly id: ParticipationId
  readonly taskId: TaskId
  readonly participant: Participant
  readonly role: ParticipationRole
  readonly hoursHundredths: number
  readonly rateCents: number
  readonly addedAt: string
}

export function createParticipation(input: Participation): Participation {
  const role = parseParticipationRole(input.role)
  if (input.participant.kind !== 'user' && input.participant.kind !== 'contributor')
    throw new ValidationError('Participante inválido')
  if (role === 'responsible' && input.participant.kind !== 'user')
    throw new ValidationError('Responsável deve ser usuário')
  validateHundredths(input.hoursHundredths)
  validateHundredths(input.rateCents)
  return { ...input, participant: { ...input.participant }, role }
}
