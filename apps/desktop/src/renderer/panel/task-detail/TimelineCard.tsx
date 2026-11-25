import type { TimelineEventDto } from '@agilebox/contract'
import { groupActivity } from './group-activity'
import { format } from 'date-fns'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import { taskCopy } from './task-detail-copy'
import { useTimeline } from './use-participations'
import styles from './TaskDetailView.module.css'

export interface TimelineCardProps {
  readonly taskId: string
}

/** Linha do tempo: toda edição, com data e hora, quem editou e, se foi o gestor, a marca Gestor. */
export function TimelineCard({ taskId }: TimelineCardProps) {
  const timeline = useTimeline(taskId)
  const users = useSessionUsers()
  const names = new Map((users.data ?? []).map((user) => [user.id, user.name]))
  const groups = groupActivity(timeline.data ?? [])
  const total = timeline.data?.length ?? 0

  const managerBadge = (
    <span className={`${styles.badge} ${styles.badgeGestor}`}>{panelCopy.managerMark}</span>
  )

  function eventContent(event: TimelineEventDto) {
    return (
      <>
        <div className={styles.timelineHead}>
          <strong>{names.get(event.actorUserId) ?? '—'}</strong>
          {event.asManager ? managerBadge : null}
          <span>{format(new Date(event.at), 'dd/MM HH:mm')}</span>
        </div>
        <div className={styles.timelineDesc}>{event.text}</div>
      </>
    )
  }

  const itemClass = (event: TimelineEventDto) =>
    event.asManager ? `${styles.timelineItem} ${styles.timelineManager}` : styles.timelineItem

  return (
    <section className={styles.topicSection} aria-labelledby="task-section-timeline">
      <div className={styles.topicSectionHead}>
        <h2 className={styles.topicSectionTitle} id="task-section-timeline">
          {taskCopy.timelineTitle}
        </h2>
        <span className={styles.topicSectionMeta}>{taskCopy.timelineCount(total)}</span>
      </div>
      {groups.length === 0 && !timeline.isPending ? (
        <p className={styles.emptyNote}>{panelCopy.noUpdates}</p>
      ) : (
        <ol className={styles.timelineList}>
          {groups.map((group) => {
            const first = group[0]!
            if (group.length === 1)
              return (
                <li key={first.id} className={itemClass(first)}>
                  {eventContent(first)}
                </li>
              )
            const action = group.every((event) => event.type === 'status_changed')
              ? 'moveu'
              : 'alterou'
            return (
              <li key={first.id} className={itemClass(first)}>
                <details>
                  <summary className={styles.activitySummary}>
                    {names.get(first.actorUserId) ?? '—'} {action} esta tarefa {group.length} vezes
                    em {format(new Date(first.at), 'dd/MM')}
                    {first.asManager && managerBadge} · ver
                  </summary>
                  <ol className={styles.activityGroup}>
                    {group.map((event) => (
                      <li key={event.id} className={itemClass(event)}>
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
