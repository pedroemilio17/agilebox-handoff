import { addDays, parseDateKey } from '../../shared/lib/calendar-grid'

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
export const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const WEEKDAYS_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

/** "16 de novembro" ou, com ano, "16 de novembro de 2026". */
export function naturalDate(key: string, withYear = false): string {
  const date = parseDateKey(key)
  const base = `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`
  return withYear ? `${base} de ${date.getUTCFullYear()}` : base
}

export const dayOfMonth = (key: string): number => parseDateKey(key).getUTCDate()

/** Segunda-feira da semana do dia. */
export function mondayOf(key: string): string {
  return addDays(key, -((parseDateKey(key).getUTCDay() + 6) % 7))
}

/** Os 7 dias (seg–dom) da semana do dia. */
export function weekDays(key: string): string[] {
  const monday = mondayOf(key)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

/** Dias exibidos no mês: semanas completas seg–dom que cobrem o mês (5 ou 6 linhas). */
export function monthGridDays(key: string): string[] {
  const date = parseDateKey(key)
  const first = `${key.slice(0, 7)}-01`
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  const start = mondayOf(first)
  const lastKey = last.toISOString().slice(0, 10)
  const rows = Math.ceil(
    ((parseDateKey(lastKey).getTime() - parseDateKey(start).getTime()) / 86_400_000 + 1) / 7,
  )
  return Array.from({ length: rows * 7 }, (_, index) => addDays(start, index))
}

export type AgendaMode = 'day' | 'week' | 'month'

/** Título do período, como no design. */
export function periodTitle(mode: AgendaMode, key: string): string {
  if (mode === 'day') {
    return `${WEEKDAYS_LONG[parseDateKey(key).getUTCDay()]}, ${naturalDate(key, true)}`
  }
  if (mode === 'month') {
    const date = parseDateKey(key)
    const name = MONTHS[date.getUTCMonth()]!
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${date.getUTCFullYear()}`
  }
  const monday = mondayOf(key)
  const sunday = addDays(monday, 6)
  return parseDateKey(monday).getUTCMonth() === parseDateKey(sunday).getUTCMonth()
    ? `${dayOfMonth(monday)} – ${naturalDate(sunday, true)}`
    : `${naturalDate(monday)} – ${naturalDate(sunday, true)}`
}
