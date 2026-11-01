import { format } from 'date-fns'
import { GlassSurface } from '@agilebox/ui'
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
  const events = [...(timeline.data ?? [])].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <GlassSurface variant="group" className={styles.card} aria-label={panelCopy.timelineCard}>
      <h3 className={styles.cardTitle}>{panelCopy.timelineCard}</h3>
      {events.length === 0 && !timeline.isPending ? (
        <p className={styles.helper}>{panelCopy.noUpdates}</p>
      ) : (
        <ol className={styles.timeline}>
          {events.map((event) => (
            <li key={event.id} className={styles.event}>
              <span className={styles.helper}>
                {format(new Date(event.at), 'dd/MM HH:mm')} · {names.get(event.actorUserId) ?? '—'}
                {event.asManager ? (
                  <span className={styles.managerMark}>{panelCopy.managerMark}</span>
                ) : null}
              </span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      )}
    </GlassSurface>
  )
}
