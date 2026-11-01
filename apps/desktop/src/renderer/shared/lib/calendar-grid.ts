export interface CalendarCell {
  /** AAAA-MM-DD */
  readonly date: string
  readonly day: number
  readonly inMonth: boolean
  readonly isToday: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day))
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateKey(date)
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${pad(monthIndex + 1)}`
}

/** 6 semanas × 7 dias, começando no domingo; `monthIndex` vai de 0 a 11 e `today` é AAAA-MM-DD. */
export function buildCalendarGrid(
  year: number,
  monthIndex: number,
  today: string,
): readonly CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const start = new Date(Date.UTC(year, monthIndex, 1 - first.getUTCDay()))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = toDateKey(date)
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex && date.getUTCFullYear() === year,
      isToday: key === today,
    }
  })
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const total = year * 12 + monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 }
}
