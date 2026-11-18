import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { MeetingOccurrenceDto, SprintDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { RetroActions } from '../agenda/RetroActions'
import { useSessionUsers } from '../hooks/use-session-users'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

/** Retro da sprint: a ocorrência mais recente de retro dentro do período da sprint. */
export function pickSprintRetro(
  meetings: readonly MeetingOccurrenceDto[],
  sprint: Pick<SprintDto, 'plannedStart' | 'plannedEnd'>,
): MeetingOccurrenceDto | null {
  const retros = meetings
    .filter(
      (meeting) =>
        meeting.kind === 'retro' &&
        meeting.occurrenceDate >= sprint.plannedStart &&
        meeting.occurrenceDate <= sprint.plannedEnd,
    )
    .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))
  return retros[0] ?? null
}

/**
 * Coluna "Retrospectiva" do encerramento (design "Encerrar"). Reaproveita os combinados da retro
 * da Agenda: a mesma lista, o mesmo caso de uso. Sem retro no período, diz isso.
 */
export function SprintRetroPanel({ sprint }: { readonly sprint: SprintDto }) {
  const api = useApi()
  const actor = useActor()
  const users = useSessionUsers()
  const headingId = useId()
  const canManage = actor.capabilities?.canManageMeetings ?? false
  const meetings = useQuery({
    queryKey: [
      ...queryKeys.meetings.all,
      'sprint',
      sprint.id,
      sprint.plannedStart,
      sprint.plannedEnd,
    ],
    queryFn: () =>
      api.meetings.list({ rangeStart: sprint.plannedStart, rangeEnd: sprint.plannedEnd }),
  })
  const retro = meetings.data ? pickSprintRetro(meetings.data, sprint) : null

  return (
    <aside aria-labelledby={headingId} className={styles.retroSide}>
      <h3 id={headingId} className={styles.retroTitle}>
        {sprintCopy.retroTitle}
      </h3>
      {meetings.isPending ? (
        <p role="status" className={styles.hint}>
          {sprintCopy.retroLoading}
        </p>
      ) : meetings.isError ? (
        <p role="alert" className={styles.error}>
          {sprintCopy.retroError}
        </p>
      ) : retro ? (
        <RetroActions
          meeting={retro}
          today={todayDateOnly()}
          users={users.data ?? []}
          canManage={canManage}
        />
      ) : (
        <p className={styles.hint}>{sprintCopy.retroNone}</p>
      )}
    </aside>
  )
}
