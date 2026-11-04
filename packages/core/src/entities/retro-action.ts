import { ValidationError } from '../shared/errors'
import type { MeetingId, OrganizationId, RetroActionId, UserId } from '../shared/ids'
import { compareDateOnly, parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { validateRetroActionTitle } from './validation'

/**
 * Combinado (ação acordada) de uma ocorrência de agendamento do tipo Retro.
 * `occurrenceDate` é a ocorrência da série à qual o combinado pertence.
 * O responsável é sempre um usuário: entidades nunca recebem combinados nem avisos.
 */
export interface RetroAction {
  readonly id: RetroActionId
  readonly organizationId: OrganizationId
  readonly meetingId: MeetingId
  readonly occurrenceDate: DateOnly
  readonly title: string
  readonly responsibleId: UserId | null
  /** Não anterior à data da ocorrência. */
  readonly dueDate: DateOnly | null
  readonly done: boolean
  readonly doneAt: string | null
  readonly createdAt: string
  readonly createdBy: UserId
}

export function createRetroAction(input: RetroAction): RetroAction {
  const title = validateRetroActionTitle(input.title)
  const occurrenceDate = parseDateOnly(input.occurrenceDate)
  const dueDate = input.dueDate === null ? null : parseDateOnly(input.dueDate)
  if (dueDate !== null && compareDateOnly(dueDate, occurrenceDate) < 0)
    throw new ValidationError('Prazo anterior à data da ocorrência')
  if (input.done !== (input.doneAt !== null))
    throw new ValidationError('Combinado com estado de conclusão inconsistente')
  return { ...input, title, occurrenceDate, dueDate }
}
