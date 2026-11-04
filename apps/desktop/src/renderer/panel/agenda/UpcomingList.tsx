import type { MeetingOccurrenceDto, SessionUserDto } from '@agilebox/contract'
import { Avatar, KindBadge } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'
import { dayParts, timeRange } from './meeting-format'
import { occurrenceKey } from './meeting-layout'

export interface UpcomingListProps {
  readonly users?: readonly SessionUserDto[]
  readonly compact?: boolean
  readonly meetings: readonly MeetingOccurrenceDto[]
  readonly canEdit: boolean
  readonly onEdit: (meeting: MeetingOccurrenceDto) => void
}

/** Horário em mono: "09:00 – 10:00" quando há fim informado; só o início caso contrário. */
const scheduleLabel = (meeting: MeetingOccurrenceDto) =>
  meeting.endTime ? timeRange(meeting.time, meeting.occurrenceEndTime) : meeting.time

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
          {(compact ? meetings.slice(0, 2) : meetings).map((meeting) => {
            const day = dayParts(meeting.occurrenceDate)
            const repeats = meeting.recurrence === 'weekly'
            return (
              <li key={occurrenceKey(meeting)}>
                <button
                  type="button"
                  className={styles.upcomingItem}
                  disabled={!canEdit}
                  onClick={() => onEdit(meeting)}
                >
                  <span className={styles.upcomingDay}>
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                  </span>
                  <span className={styles.upcomingBody}>
                    <span className={styles.upcomingTitle}>{meeting.title}</span>
                    <span className={styles.upcomingMeta}>
                      <time className={styles.mono}>{scheduleLabel(meeting)}</time>
                      <KindBadge kind={meeting.kind} />
                      {repeats ? <span>{panelCopy.weeklyLabel}</span> : null}
                    </span>
                    <span className={styles.meetingPeople}>
                      {meeting.participants.map((id) => {
                        const person = users.find((user) => user.id === id)
                        return person ? <Avatar key={id} name={person.name} /> : null
                      })}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {compact && meetings.length > 2 && (
        <p className={styles.helper}>+ {meetings.length - 2} mais</p>
      )}
    </section>
  )
}
