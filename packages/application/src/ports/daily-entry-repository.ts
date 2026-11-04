import type { DailyEntry, DateOnly, OrganizationId, UserId } from '@agilebox/core'

export interface DailyEntryRepository {
  /** Daily da pessoa na data (no máximo uma). */
  findByUserAndDate(
    organizationId: OrganizationId,
    userId: UserId,
    date: DateOnly,
  ): Promise<DailyEntry | null>
  /** Dailies de todas as pessoas da organização na data. */
  listByDate(organizationId: OrganizationId, date: DateOnly): Promise<readonly DailyEntry[]>
  /** Insere ou atualiza pelo id. Ignora daily de pessoa de outra organização. */
  save(organizationId: OrganizationId, entry: DailyEntry): Promise<void>
}
