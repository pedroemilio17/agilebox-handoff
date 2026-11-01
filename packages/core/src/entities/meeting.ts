import { ValidationError } from '../shared/errors'
import type { MeetingId, OrganizationId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { validateName } from './validation'

export interface Meeting {
  readonly id: MeetingId
  readonly organizationId: OrganizationId
  readonly title: string
  readonly date: DateOnly
  readonly time: string
  readonly participants: readonly UserId[]
  readonly createdBy: UserId
  readonly createdAt: string
  readonly updatedAt: string
}

export function createMeeting(input: Meeting): Meeting {
  const title = validateName(input.title)
  const date = parseDateOnly(input.date)
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new ValidationError('Hora inválida')
  return { ...input, title, date, participants: [...input.participants] }
}
