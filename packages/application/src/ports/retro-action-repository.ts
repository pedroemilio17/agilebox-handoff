import type {
  DateOnly,
  MeetingId,
  OrganizationId,
  RetroAction,
  RetroActionId,
} from '@agilebox/core'

export interface RetroActionRepository {
  findById(organizationId: OrganizationId, actionId: RetroActionId): Promise<RetroAction | null>
  /** Combinados de uma ocorrência (agendamento + data), em ordem de criação. */
  listByOccurrence(
    organizationId: OrganizationId,
    meetingId: MeetingId,
    occurrenceDate: DateOnly,
  ): Promise<readonly RetroAction[]>
  /** Combinados de vários agendamentos (para as contagens da agenda). Inclui datas que deixaram de ser ocorrências. */
  listByMeetings(
    organizationId: OrganizationId,
    meetingIds: readonly MeetingId[],
  ): Promise<readonly RetroAction[]>
  /** Insere ou atualiza. Ignora combinados de agendamento de outra organização. */
  save(organizationId: OrganizationId, action: RetroAction): Promise<void>
  remove(organizationId: OrganizationId, actionId: RetroActionId): Promise<void>
}
