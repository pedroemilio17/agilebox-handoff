import { format, formatDistance } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const weekdayAbbreviations = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatDate(date: Date): string {
  const weekday = weekdayAbbreviations[date.getDay()]
  return `${weekday}, ${format(date, 'dd MMM', { locale: ptBR }).replaceAll('.', '')}`
}

export function formatRelativeDate(date: Date, now: Date): string {
  return formatDistance(date, now, { addSuffix: true, locale: ptBR }).replace(
    / (minutos?|horas?)(?=\b)/,
    (unit) => (unit.startsWith(' minuto') ? ' min' : ' h'),
  )
}
