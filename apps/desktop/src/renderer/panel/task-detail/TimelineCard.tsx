import type { TimelineEventDto } from '@agilebox/contract'
import { groupActivity } from './group-activity'
import { format } from 'date-fns'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import { useTimeline } from './use-participations'
import styles from './TaskDetailView.module.css'

export interface TimelineCardProps {
  readonly taskId: string
}

export function TimelineCard({ taskId }: TimelineCardProps) {
  const timeline = useTimeline(taskId)
  const users = useSessionUsers()
  const names = new Map((users.data ?? []).map((user) => [user.id, user.name]))
  const groups = groupActivity(timeline.data ?? [])
  function eventContent(event: TimelineEventDto) {
    return (
      <>
        <span className={styles.helper}>
          {format(new Date(event.at), 'dd/MM HH:mm')} · {names.get(event.actorUserId) ?? '—'}
          {event.asManager && <span className={styles.managerMark}>{panelCopy.managerMark}</span>}
        </span>
        <span>{event.text}</span>
      </>
    )
  }

  return (
    <section className={styles.card} aria-label={panelCopy.timelineCard}>
      <h3 className={styles.cardTitle}>{panelCopy.timelineCard}</h3>
      {groups.length === 0 && !timeline.isPending ? (
        <p className={styles.helper}>{panelCopy.noUpdates}</p>
      ) : (
        <ol className={styles.timeline}>
          {groups.map((group) => {
            const first = group[0]!
            if (group.length === 1)
              return (
                <li key={first.id} className={styles.event}>
                  {eventContent(first)}
                </li>
              )
            const action = group.every((event) => event.type === 'status_changed')
              ? 'moveu'
              : 'alterou'
            return (
              <li key={first.id} className={styles.event}>
                <details>
                  <summary className={styles.activitySummary}>
                    {names.get(first.actorUserId) ?? '—'} {action} esta tarefa {group.length} vezes
                    em {format(new Date(first.at), 'dd/MM')}
                    {first.asManager && (
                      <span className={styles.managerMark}>{panelCopy.managerMark}</span>
                    )}{' '}
                    · ver
                  </summary>
                  <ol className={styles.activityGroup}>
                    {group.map((event) => (
                      <li key={event.id} className={styles.event}>
                        {eventContent(event)}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
