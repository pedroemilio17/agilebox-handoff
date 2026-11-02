import type { OrganizationId, Participation, ParticipationId, TaskId } from '@agilebox/core'

export interface ParticipationRepository {
  findById(
    organizationId: OrganizationId,
    participationId: ParticipationId,
  ): Promise<Participation | null>
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly Participation[]>
  save(organizationId: OrganizationId, participation: Participation): Promise<void>
  remove(organizationId: OrganizationId, participationId: ParticipationId): Promise<void>
  /** Quantas participações a organização tem. Usada pela prévia de impacto. */
  count(organizationId: OrganizationId): Promise<number>
}
