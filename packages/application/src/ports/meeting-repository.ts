import type { DateOnly } from '@agilebox/core'
import type { Meeting, MeetingId, OrganizationId } from '@agilebox/core'

export interface MeetingRepository {
  findById(organizationId: OrganizationId, meetingId: MeetingId): Promise<Meeting | null>
  /**
   * Séries e avulsos que podem ter ocorrência em [rangeStart, rangeEnd].
   * É um filtro grosso: a expansão no core confirma cada ocorrência.
   */
  listOverlapping(
    organizationId: OrganizationId,
    rangeStart: DateOnly,
    rangeEnd: DateOnly,
  ): Promise<readonly Meeting[]>
  save(organizationId: OrganizationId, meeting: Meeting): Promise<void>
  remove(organizationId: OrganizationId, meetingId: MeetingId): Promise<void>
}
