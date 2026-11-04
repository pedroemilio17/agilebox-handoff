import { ValidationError } from '../shared/errors'
import type { DailyEntry } from '../entities/daily-entry'
import { compareDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/** Indica se a lista (daily de uma mesma pessoa) já tem entrada na data. */
export function hasDailyForDate(entries: readonly DailyEntry[], date: DateOnly): boolean {
  return entries.some((entry) => entry.date === date)
}

/** A daily é devida enquanto a pessoa não tiver uma na data. A data local vem de quem chama. */
export function isDailyDue(entries: readonly DailyEntry[], date: DateOnly): boolean {
  return !hasDailyForDate(entries, date)
}

/** Data futura nunca é aceita, nem para leitura nem para escrita. */
export function assertDailyDateNotFuture(date: DateOnly, today: DateOnly): void {
  if (compareDateOnly(date, today) > 0) throw new ValidationError('Data futura não é permitida')
}
