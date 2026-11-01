import { ValidationError } from '../shared/errors'

declare const dateOnlyBrand: unique symbol
export type DateOnly = string & { readonly [dateOnlyBrand]: true }

export function isDateOnly(value: string): value is DateOnly {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year === 0 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (days[month - 1] ?? 0)
}

export function parseDateOnly(value: string): DateOnly {
  if (!isDateOnly(value)) throw new ValidationError('Data inválida')
  return value
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function calendarTimestamp(value: DateOnly): number {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  )
  return date.getTime()
}

/** Número de dias de calendário de a até b. */
export function diffInDays(a: DateOnly, b: DateOnly): number {
  return (calendarTimestamp(b) - calendarTimestamp(a)) / 86_400_000
}

export function toDateOnly(date: Date, timeZone: string): DateOnly {
  if (!Number.isFinite(date.getTime())) throw new ValidationError('Instante inválido')
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      era: 'short',
    }).formatToParts(date)
  } catch {
    throw new ValidationError('Fuso horário inválido')
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  if (part('era') !== 'AD') throw new ValidationError('Data inválida')
  return parseDateOnly(`${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`)
}
