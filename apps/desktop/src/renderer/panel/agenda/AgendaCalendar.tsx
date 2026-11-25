import type { MeetingOccurrenceDto, TaskDto } from '@agilebox/contract'
import { agendaCopy } from './agenda-copy'
import {
  WEEKDAYS_SHORT,
  dayOfMonth,
  monthGridDays,
  naturalDate,
  weekDays,
  type AgendaMode,
} from './agenda-dates'
import styles from './Agenda.module.css'
import { categoryOf, dotClass, timeRange } from './meeting-format'
import { occurrenceKey } from './meeting-layout'

export interface AgendaCalendarProps {
  readonly mode: AgendaMode
  readonly focusDate: string
  readonly today: string
  readonly meetings: readonly MeetingOccurrenceDto[]
  readonly tasks: readonly TaskDto[]
  readonly onOpenMeeting: (meeting: MeetingOccurrenceDto) => void
  readonly onOpenTask: (id: string) => void
}

const byTime = (a: MeetingOccurrenceDto, b: MeetingOccurrenceDto) => a.time.localeCompare(b.time)

function Dot({ meeting }: { readonly meeting: MeetingOccurrenceDto }) {
  return (
    <span
      className={`${styles.catDot} ${styles[dotClass(categoryOf(meeting))]}`}
      aria-hidden="true"
    />
  )
}

/** Visão Semana, Dia ou Mês do design; o corpo muda conforme o modo. */
export function AgendaCalendar({
  mode,
  focusDate,
  today,
  meetings,
  tasks,
  onOpenMeeting,
  onOpenTask,
}: AgendaCalendarProps) {
  const on = (date: string) => meetings.filter((m) => m.occurrenceDate === date).sort(byTime)
  const deadlinesOn = (date: string) => tasks.filter((task) => task.deadline === date)

  if (mode === 'week') {
    return (
      <div className={styles.weekGrid} role="group" aria-label="Agenda semanal">
        {weekDays(focusDate).map((date, index) => {
          const events = on(date)
          const deadlines = deadlinesOn(date)
          return (
            <div
              key={date}
              className={`${styles.weekCol} ${date === today ? styles.isToday : ''}`}
              aria-current={date === today ? 'date' : undefined}
            >
              <div className={styles.weekColHead}>
                <span className={styles.weekDayName}>{WEEKDAYS_SHORT[index]}</span>
                <span className={styles.weekDayNum}>{dayOfMonth(date)}</span>
              </div>
              <div className={styles.weekColEvents}>
                {events.length === 0 && deadlines.length === 0 ? (
                  <span className={styles.free}>{agendaCopy.free}</span>
                ) : null}
                {events.map((meeting) => (
                  <button
                    key={occurrenceKey(meeting)}
                    type="button"
                    className={styles.eventPill}
                    title={`${meeting.time} · ${categoryOf(meeting)} · ${meeting.title}`}
                    onClick={() => onOpenMeeting(meeting)}
                  >
                    <span className={styles.eventPillMeta}>
                      <Dot meeting={meeting} />
                      <span className={styles.eventPillTime}>{meeting.time}</span>
                    </span>
                    <span className={styles.eventPillTitle}>{meeting.title}</span>
                  </button>
                ))}
                {deadlines.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={styles.eventPill}
                    aria-label={agendaCopy.openTask(task.title)}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className={styles.eventPillTime}>{agendaCopy.deadline}</span>
                    <span className={styles.eventPillTitle}>{task.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (mode === 'day') {
    const events = on(focusDate)
    const deadlines = deadlinesOn(focusDate)
    if (events.length === 0 && deadlines.length === 0) {
      return (
        <div className={styles.emptyState}>
          <h3>{agendaCopy.emptyDayTitle(naturalDate(focusDate))}</h3>
          <p>{agendaCopy.emptyDayText}</p>
        </div>
      )
    }
    return (
      <div className={styles.dayViewList}>
        {events.map((meeting) => {
          const sub = [
            meeting.endTime ? timeRange(meeting.time, meeting.occurrenceEndTime) : null,
            meeting.recurrence === 'weekly' ? agendaCopy.weekly : null,
          ].filter(Boolean)
          return (
            <button
              key={occurrenceKey(meeting)}
              type="button"
              className={styles.dayEventRow}
              onClick={() => onOpenMeeting(meeting)}
            >
              <div className={styles.dayEventMain}>
                <span className={styles.dayEventTime}>{meeting.time}</span>
                <div>
                  <div className={styles.dayEventTitle}>{meeting.title}</div>
                  {sub.length ? <div className={styles.dayEventSub}>{sub.join(' · ')}</div> : null}
                </div>
              </div>
              <span className={styles.dayCatInline}>
                <Dot meeting={meeting} />
                <span>{categoryOf(meeting)}</span>
              </span>
            </button>
          )
        })}
        {deadlines.map((task) => (
          <button
            key={task.id}
            type="button"
            className={styles.dayEventRow}
            aria-label={agendaCopy.openTask(task.title)}
            onClick={() => onOpenTask(task.id)}
          >
            <div className={styles.dayEventMain}>
              <span className={styles.dayEventTime}>{agendaCopy.deadline}</span>
              <div className={styles.dayEventTitle}>{task.title}</div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  const month = focusDate.slice(0, 7)
  return (
    <div className={styles.monthGrid} role="group" aria-label="Agenda mensal">
      {WEEKDAYS_SHORT.map((weekday) => (
        <div key={weekday} className={styles.monthHeadCell}>
          {weekday}
        </div>
      ))}
      {monthGridDays(focusDate).map((date) => {
        const events = on(date)
        return (
          <div
            key={date}
            className={[
              styles.monthCell,
              date.slice(0, 7) !== month ? styles.isMuted : '',
              date === today ? styles.isToday : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={date === today ? 'date' : undefined}
            data-date={date}
          >
            <span className={styles.monthCellNum}>{dayOfMonth(date)}</span>
            {events.slice(0, 2).map((meeting) => (
              <button
                key={occurrenceKey(meeting)}
                type="button"
                className={styles.monthChip}
                onClick={() => onOpenMeeting(meeting)}
              >
                <Dot meeting={meeting} />
                <span className={styles.monthChipLabel}>
                  {meeting.time} {meeting.title}
                </span>
              </button>
            ))}
            {events.length > 2 ? (
              <span className={styles.monthMore}>{agendaCopy.more(events.length - 2)}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
