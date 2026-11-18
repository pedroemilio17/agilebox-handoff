import type { MeetingKind } from '../entities/meeting'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/**
 * Cerimônias de sprint (ADR-10, "Cerimônias"): planning, review e retrospectiva viram eventos da
 * Agenda, criados pelo gestor. Não há tipo `planning` no agendamento: a planning é uma reunião
 * (`meeting`) identificada pelo título. Assim não muda o schema (CHECK de `meetings.kind`).
 */
export const CEREMONY_KINDS = ['planning', 'review', 'retro'] as const
export type CeremonyKind = (typeof CEREMONY_KINDS)[number]

/** Tipo de agendamento que cada cerimônia usa. */
export const CEREMONY_MEETING_KIND: Readonly<Record<CeremonyKind, MeetingKind>> = {
  planning: 'meeting',
  review: 'review',
  retro: 'retro',
}

/**
 * Horário sugerido (provisório, a combinar com o Pedro): planning às 09:00 no início da sprint;
 * review às 10:00 e retro às 11:00 no fim, nessa ordem. A Agenda permite ajustar depois.
 */
export const CEREMONY_SUGGESTED_TIME: Readonly<Record<CeremonyKind, string>> = {
  planning: '09:00',
  review: '10:00',
  retro: '11:00',
}

/** Dados da sprint que a sugestão usa. Datas em `YYYY-MM-DD`. */
export interface CeremonySprint {
  readonly number: number
  readonly plannedStart: string
  readonly plannedEnd: string
}

export interface CeremonySuggestion {
  readonly ceremony: CeremonyKind
  readonly title: string
  readonly meetingKind: MeetingKind
  readonly date: DateOnly
  readonly time: string
}

const CEREMONY_TITLES: Readonly<Record<CeremonyKind, (sprintNumber: number) => string>> = {
  planning: (number) => `Planning da Sprint ${number}`,
  review: (number) => `Review da Sprint ${number}`,
  retro: (number) => `Retrospectiva da Sprint ${number}`,
}

/**
 * Título e data sugeridos para a cerimônia de uma sprint. A planning cai no início planejado; a
 * review e a retro, no fim planejado. O título usa o número da sprint, não o nome livre.
 */
export function suggestCeremony(
  sprint: CeremonySprint,
  ceremony: CeremonyKind,
): CeremonySuggestion {
  return {
    ceremony,
    title: CEREMONY_TITLES[ceremony](sprint.number),
    meetingKind: CEREMONY_MEETING_KIND[ceremony],
    date: parseDateOnly(ceremony === 'planning' ? sprint.plannedStart : sprint.plannedEnd),
    time: CEREMONY_SUGGESTED_TIME[ceremony],
  }
}
