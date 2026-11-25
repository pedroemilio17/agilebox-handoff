import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { addDays } from '../../shared/lib/calendar-grid'
import { agendaCopy } from './agenda-copy'
import { naturalDate } from './agenda-dates'
import styles from './Agenda.module.css'
import { categoryOf, dotClass } from './meeting-format'
import { occurrenceKey } from './meeting-layout'

export interface UpcomingSectionProps {
  readonly meetings: readonly MeetingOccurrenceDto[]
  readonly today: string
  readonly onOpen: (meeting: MeetingOccurrenceDto) => void
}

/** "Próximos 7 dias": de hoje a hoje + 6, em ordem de data e hora. */
export function UpcomingSection({ meetings, today, onOpen }: UpcomingSectionProps) {
  const last = addDays(today, 6)
  const upcoming = meetings
    .filter((meeting) => meeting.occurrenceDate >= today && meeting.occurrenceDate <= last)
    .sort((a, b) => `${a.occurrenceDate}${a.time}`.localeCompare(`${b.occurrenceDate}${b.time}`))
  const tomorrow = addDays(today, 1)
  return (
    <section className={styles.asideSection} aria-label={agendaCopy.upcoming}>
      <div className={styles.asideSectionHead}>
        <h2>{agendaCopy.upcoming}</h2>
        <span className={styles.asideSectionMeta}>{agendaCopy.upcomingCount(upcoming.length)}</span>
      </div>
      {upcoming.length === 0 ? (
        <p className={styles.helper}>{agendaCopy.upcomingEmpty}</p>
      ) : (
        <div className={styles.upcomingList}>
          {upcoming.map((meeting) => {
            const category = categoryOf(meeting)
            const day =
              meeting.occurrenceDate === today
                ? agendaCopy.today
                : meeting.occurrenceDate === tomorrow
                  ? agendaCopy.tomorrow
                  : naturalDate(meeting.occurrenceDate)
            const sub = [
              meeting.recurrence === 'weekly' ? agendaCopy.weekly : null,
              meeting.kind === 'retro' && meeting.retroActionsCount > 0
                ? `${meeting.retroActionsDone}/${meeting.retroActionsCount} combinados`
                : null,
            ].filter(Boolean)
            return (
              <button
                key={occurrenceKey(meeting)}
                type="button"
                className={styles.upcomingItem}
                onClick={() => onOpen(meeting)}
              >
                <div className={styles.upcomingMeta}>
                  <span className={styles.upcomingDayLabel}>
                    <span
                      className={`${styles.catDot} ${styles[dotClass(category)]}`}
                      aria-hidden="true"
                    />
                    <span>{day}</span>
                  </span>
                  <span className={styles.upcomingTime}>
                    {meeting.time} · {category}
                  </span>
                </div>
                <div className={styles.upcomingTitle}>{meeting.title}</div>
                {sub.length ? <div className={styles.upcomingSub}>{sub.join(' · ')}</div> : null}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
