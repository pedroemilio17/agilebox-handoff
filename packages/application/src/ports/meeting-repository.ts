import type { DateOnly } from '@agilebox/core'
import type { Meeting, MeetingId, OrganizationId } from '@agilebox/core'

export interface MeetingRepository {
  findById(organizationId: OrganizationId, meetingId: MeetingId): Promise<Meeting | null>
  listByMonth(organizationId: OrganizationId, month: string): Promise<readonly Meeting[]>
  listUpcoming(organizationId: OrganizationId, today: DateOnly): Promise<readonly Meeting[]>
  save(organizationId: OrganizationId, meeting: Meeting): Promise<void>
  remove(organizationId: OrganizationId, meetingId: MeetingId): Promise<void>
  /** Quantas reuniões a organização tem. Usada pela prévia de impacto. */
  count(organizationId: OrganizationId): Promise<number>
}
