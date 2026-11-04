import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { MeetingOccurrenceDto } from '@agilebox/contract'
import { Button, RepeatMark } from '@agilebox/ui'
import { addDays, buildCalendarGrid } from '../../shared/lib/calendar-grid'
import { panelCopy } from '../copy'
import styles from './Agenda.module.css'
import { eventClass } from './meeting-format'
import { occurrenceKey } from './meeting-layout'

export interface CalendarProps {
  readonly year: number
  readonly monthIndex: number
  readonly today: string
  readonly selectedDate: string
  readonly meetings: readonly MeetingOccurrenceDto[]
  readonly onSelectDate: (date: string) => void
  readonly onPreviousMonth: () => void
  readonly onNextMonth: () => void
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MAX_VISIBLE = 2

const monthTitle = (year: number, monthIndex: number) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  )

const longDate = (key: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${key}T00:00:00Z`),
  )

export function Calendar({
  year,
  monthIndex,
  today,
  selectedDate,
  meetings,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: CalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const cells = buildCalendarGrid(year, monthIndex, today)

  // Navegar pelo teclado leva o foco junto com a seleção.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid?.contains(document.activeElement)) return
    grid.querySelector<HTMLButtonElement>(`[data-date="${selectedDate}"]`)?.focus()
  }, [selectedDate])
  const byDate = new Map<string, MeetingOccurrenceDto[]>()
  for (const meeting of [...meetings].sort((a, b) => a.time.localeCompare(b.time))) {
    byDate.set(meeting.occurrenceDate, [...(byDate.get(meeting.occurrenceDate) ?? []), meeting])
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const delta = step[event.key]
    if (delta === undefined) return
    event.preventDefault()
    onSelectDate(addDays(date, delta))
  }

  return (
    <section className={styles.calendar} aria-label={panelCopy.agendaTitle}>
      <header className={styles.calendarHeader}>
        <h2 className={styles.monthTitle}>{monthTitle(year, monthIndex)}</h2>
        <div className={styles.monthNav}>
          <Button type="button" aria-label={panelCopy.previousMonth} onClick={onPreviousMonth}>
            ‹
          </Button>
          <Button type="button" aria-label={panelCopy.nextMonth} onClick={onNextMonth}>
            ›
          </Button>
        </div>
      </header>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        className={styles.grid}
        role="group"
        aria-label={monthTitle(year, monthIndex)}
      >
        {cells.map((cell) => {
          const events = byDate.get(cell.date) ?? []
          const selected = cell.date === selectedDate
          return (
            <button
              key={cell.date}
              type="button"
              className={[
                styles.day,
                cell.inMonth ? '' : styles.outside,
                cell.isToday ? styles.today : '',
                selected ? styles.selected : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${longDate(cell.date)}${events.length ? `, ${events.length} agendamento(s)` : ''}`}
              aria-pressed={selected}
              aria-current={cell.isToday ? 'date' : undefined}
              tabIndex={selected ? 0 : -1}
              data-date={cell.date}
              onClick={() => onSelectDate(cell.date)}
              onKeyDown={(event) => onKeyDown(event, cell.date)}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              {events.slice(0, MAX_VISIBLE).map((meeting) => (
                <span
                  key={occurrenceKey(meeting)}
                  className={`${styles.event} ${styles[eventClass(meeting.kind)]}`}
                >
                  <span className={styles.eventText}>
                    {meeting.time} {meeting.title}
                  </span>
                  {meeting.recurrence === 'weekly' ? <RepeatMark /> : null}
                </span>
              ))}
              {events.length > MAX_VISIBLE ? (
                <span className={styles.more}>
                  {panelCopy.moreEvents(events.length - MAX_VISIBLE)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
