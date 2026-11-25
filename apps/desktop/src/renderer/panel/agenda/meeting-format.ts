import type { MeetingKind } from '@agilebox/ui'
import type { AgendaCategory } from './agenda-copy'

/** Intervalo "09:00 – 10:00". Sem fim informado, a agenda passa o fim efetivo (1 h). */
export const timeRange = (start: string, end: string): string => `${start} – ${end}`

/**
 * Categoria do design (Daily, Planejamento, Retrospectiva, Entrega) a partir do tipo do modelo.
 * O modelo guarda 3 tipos: reunião vira Daily quando o título diz "daily", senão Planejamento;
 * revisão vira Entrega; retro vira Retrospectiva.
 */
export function categoryOf(meeting: { kind: MeetingKind; title: string }): AgendaCategory {
  if (meeting.kind === 'retro') return 'Retrospectiva'
  if (meeting.kind === 'review') return 'Entrega'
  return /daily/i.test(meeting.title) ? 'Daily' : 'Planejamento'
}

/** Tipo do modelo gravado para cada categoria do design. */
export const kindOfCategory = (category: AgendaCategory): MeetingKind =>
  category === 'Retrospectiva' ? 'retro' : category === 'Entrega' ? 'review' : 'meeting'

/** Classe do pontinho de 6 px de cada categoria. */
export const dotClass = (
  category: AgendaCategory,
): 'catDaily' | 'catPlan' | 'catRetro' | 'catDelivery' =>
  category === 'Daily'
    ? 'catDaily'
    : category === 'Planejamento'
      ? 'catPlan'
      : category === 'Retrospectiva'
        ? 'catRetro'
        : 'catDelivery'
