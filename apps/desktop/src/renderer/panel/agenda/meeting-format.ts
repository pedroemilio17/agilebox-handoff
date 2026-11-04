import type { MeetingKind } from '@agilebox/ui'

/** Intervalo "09:00 – 10:00". Sem fim informado, a agenda passa o fim efetivo (1 h). */
export const timeRange = (start: string, end: string): string => `${start} – ${end}`

/** Classe de cor do tipo (fundo translúcido e texto claro, com rótulo e ícone ao lado). */
export const eventClass = (kind: MeetingKind): 'evMeeting' | 'evReview' | 'evRetro' =>
  kind === 'review' ? 'evReview' : kind === 'retro' ? 'evRetro' : 'evMeeting'

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const DAY_NUMBER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'UTC' })

/** Sigla do dia da semana em maiúsculas ("SEG") e dia com dois dígitos ("02"), para os Próximos. */
export function dayParts(date: string): { weekday: string; day: string } {
  const at = new Date(`${date}T00:00:00Z`)
  return {
    weekday: WEEKDAY.format(at).replace('.', '').toUpperCase(),
    day: DAY_NUMBER.format(at),
  }
}
