import { parseDateOnly } from '@agilebox/core'
import type { DateOnly } from '@agilebox/core'

/** Data de hoje no fuso local, no formato AAAA-MM-DD. */
export function todayDateOnly(now: Date = new Date()): DateOnly {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return parseDateOnly(`${now.getFullYear()}-${month}-${day}`)
}
