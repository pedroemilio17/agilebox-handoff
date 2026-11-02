import { useEffect, useRef, type CSSProperties } from 'react'
import { getISOWeek } from 'date-fns'
import type { MeetingDto, TaskDto } from '@agilebox/contract'
import { Button, StatusChip } from '@agilebox/ui'
import { addDays, parseDateKey } from '../../shared/lib/calendar-grid'
import styles from './Agenda.module.css'
import { meetingMinutes, positionMeetings } from './meeting-layout'

export function agendaDays(date: string, mode: 'day' | 'week'): string[] {
  const offset = (parseDateKey(date).getUTCDay() + 6) % 7
  return Array.from({ length: mode === 'day' ? 1 : 7 }, (_, index) =>
    addDays(date, mode === 'day' ? 0 : index - offset),
  )
}
const shortDay = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(parseDateKey(date))
const fullDay = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(
    parseDateKey(date),
  )

export interface WeekCalendarProps {
  readonly days: readonly string[]
  readonly today: string
  readonly selectedDate: string
  readonly meetings: readonly MeetingDto[]
  readonly tasks: readonly TaskDto[]
  readonly showDeadlines: boolean
  readonly canEdit: boolean
  readonly onSelectDate: (date: string) => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onEdit: (meeting: MeetingDto) => void
  readonly onOpenTask: (id: string) => void
}
export function WeekCalendar({
  days,
  today,
  selectedDate,
  meetings,
  tasks,
  showDeadlines,
  canEdit,
  onSelectDate,
  onPrevious,
  onNext,
  onEdit,
  onOpenTask,
}: WeekCalendarProps) {
  const root = useRef<HTMLElement>(null)
  const focusAfterNavigation = useRef(false)
  useEffect(() => {
    if (focusAfterNavigation.current) {
      root.current?.querySelector<HTMLButtonElement>(`[data-week-date="${selectedDate}"]`)?.focus()
      focusAfterNavigation.current = false
    }
  }, [selectedDate])
  const start = days[0]!
  const end = days.at(-1)!
  const period = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  })
  return (
    <section
      ref={root}
      className={styles.weekCalendar}
      aria-label={days.length === 1 ? 'Agenda diária' : 'Agenda semanal'}
    >
      <header className={styles.calendarHeader}>
        <div>
          <h2 className={styles.monthTitle}>
            {period.format(parseDateKey(start))}
            {start !== end && ` – ${period.format(parseDateKey(end))}`}
          </h2>
          <span className={styles.weekNumber}>
            semana {getISOWeek(new Date(`${start}T12:00:00`))}
          </span>
        </div>
        <div className={styles.monthNav}>
          <Button aria-label="Período anterior" onClick={onPrevious}>
            ‹
          </Button>
          <Button aria-label="Próximo período" onClick={onNext}>
            ›
          </Button>
        </div>
      </header>
      <div className={styles.weekScroll}>
        <div className={styles.weekGrid} style={{ '--agenda-days': days.length } as CSSProperties}>
          <div />
          {days.map((date) => (
            <button
              key={date}
              data-week-date={date}
              className={`${styles.dayHeading} ${[0, 6].includes(parseDateKey(date).getUTCDay()) ? styles.weekend : ''}`}
              aria-label={fullDay(date)}
              aria-pressed={selectedDate === date}
              aria-current={date === today ? 'date' : undefined}
              onClick={() => onSelectDate(date)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  focusAfterNavigation.current = true
                  onSelectDate(addDays(date, event.key === 'ArrowLeft' ? -1 : 1))
                }
              }}
            >
              <span>{shortDay(date)}</span>
              <strong>{date.slice(-2)}</strong>
            </button>
          ))}
          {showDeadlines && (
            <>
              <span className={styles.deadlineLabel}>prazos</span>
              {days.map((date) => (
                <div key={date} className={styles.deadlineCell}>
                  {tasks
                    .filter((task) => task.deadline === date)
                    .map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        className={styles.deadlineTask}
                        aria-label={`Abrir tarefa: ${task.title}`}
                        onClick={() => onOpenTask(task.id)}
                      >
                        <StatusChip status={task.status} compact />
                        <span>{task.title}</span>
                      </button>
                    ))}
                </div>
              ))}
            </>
          )}
          <div className={styles.hours}>
            {Array.from({ length: 11 }, (_, index) => (
              <span key={index} style={{ top: index * 52 }}>
                {String(index + 8).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((date) => (
            <div
              key={date}
              className={`${styles.hourColumn} ${[0, 6].includes(parseDateKey(date).getUTCDay()) ? styles.weekend : ''}`}
            >
              {positionMeetings(meetings.filter((meeting) => meeting.date === date)).map(
                ({ meeting, top, height, lane, lanes }) => (
                  <button
                    key={meeting.id}
                    className={styles.weekEvent}
                    style={{
                      top,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lanes}% - 8px)`,
                      right: 'auto',
                    }}
                    type="button"
                    disabled={!canEdit}
                    aria-label={`${meeting.title}, ${meeting.time}, duração de 1 hora`}
                    onClick={() => onEdit(meeting)}
                  >
                    <time>{meeting.time}</time>
                    <span>{meeting.title}</span>
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      {meetings.some(
        (meeting) =>
          days.includes(meeting.date) &&
          (meetingMinutes(meeting.time) < 480 || meetingMinutes(meeting.time) + 60 > 1080),
      ) && (
        <section className={styles.outsideHours} aria-label="Agendamentos fora da grade de 08–18">
          <h3>Fora da grade de 08–18</h3>
          {meetings
            .filter(
              (meeting) =>
                days.includes(meeting.date) &&
                (meetingMinutes(meeting.time) < 480 || meetingMinutes(meeting.time) + 60 > 1080),
            )
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .map((meeting) => (
              <button
                type="button"
                key={meeting.id}
                disabled={!canEdit}
                onClick={() => onEdit(meeting)}
              >
                {meeting.date.slice(-2)} · {meeting.time} · {meeting.title}
              </button>
            ))}
        </section>
      )}
    </section>
  )
}
