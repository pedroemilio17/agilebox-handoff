import type { MeetingDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'

export interface UpcomingListProps {
  readonly meetings: readonly MeetingDto[]
  readonly canEdit: boolean
  readonly onEdit: (meeting: MeetingDto) => void
}

const formatDay = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '')

export function UpcomingList({ meetings, canEdit, onEdit }: UpcomingListProps) {
  return (
    <section aria-label={panelCopy.upcoming} className={styles.upcoming}>
      <h3 className={styles.sectionTitle}>{panelCopy.upcoming}</h3>
      {meetings.length === 0 ? (
        <p className={styles.helper}>{panelCopy.nothingScheduled}</p>
      ) : (
        <ul className={styles.upcomingList}>
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <button
                type="button"
                className={styles.upcomingItem}
                disabled={!canEdit}
                onClick={() => onEdit(meeting)}
              >
                <span className={styles.upcomingTitle}>{meeting.title}</span>
                <span className={styles.helper}>
                  {formatDay(meeting.date)} · {meeting.time}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
