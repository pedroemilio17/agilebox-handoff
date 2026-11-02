import type { MeetingDto, SessionUserDto } from '@agilebox/contract'
import { Avatar } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'

export interface UpcomingListProps {
  readonly users?: readonly SessionUserDto[]
  readonly compact?: boolean
  readonly meetings: readonly MeetingDto[]
  readonly canEdit: boolean
  readonly onEdit: (meeting: MeetingDto) => void
}

const formatDay = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '')

export function UpcomingList({
  meetings,
  canEdit,
  onEdit,
  compact = false,
  users = [],
}: UpcomingListProps) {
  return (
    <section aria-label={panelCopy.upcoming} className={styles.upcoming}>
      <h3 className={styles.sectionTitle}>{panelCopy.upcoming}</h3>
      {meetings.length === 0 ? (
        <p className={styles.helper}>{panelCopy.nothingScheduled}</p>
      ) : (
        <ul className={styles.upcomingList}>
          {(compact ? meetings.slice(0, 2) : meetings).map((meeting) => (
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
                <span className={styles.meetingPeople}>
                  {meeting.participants.map((id) => {
                    const person = users.find((user) => user.id === id)
                    return person ? <Avatar key={id} name={person.name} /> : null
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {compact && meetings.length > 2 && (
        <p className={styles.helper}>+ {meetings.length - 2} mais</p>
      )}
    </section>
  )
}
