import { formatBRL } from '@agilebox/core'
import type { TrackingMilestoneStatus, TrackingViewDto } from '@agilebox/contract'
import { shortDateLabel } from '../milestones/milestone-rules'

type TrackingWeek = NonNullable<TrackingViewDto['week']>

/**
 * Regras de exibição da tela "Acompanhamento". Funções puras: o servidor calcula os números e o
 * status de cada marco; aqui só se escolhe o texto, o tom e a forma de mostrar cada valor.
 * Estado do marco sempre com texto e ícone, nunca só com a cor.
 */

export const trackingCopy = {
  title: 'Acompanhamento',
  noProject: 'Escolha um projeto para ver o acompanhamento.',
  loading: 'Carregando o acompanhamento…',
  loadError: 'Não foi possível carregar o acompanhamento deste projeto.',
  retry: 'Tentar de novo',
  progress: 'Concluído',
  hours: 'Horas lançadas',
  cost: 'Custo realizado',
  nextMilestone: 'Próximo marco',
  noNextMilestone: 'Nenhum marco pela frente',
  milestones: 'Marcos',
  milestonesLabel: 'Lista de marcos',
  noMilestones: 'Nenhum marco ainda.',
  openMilestones: 'Abrir os marcos',
  costOnlyManager: 'Só o gestor vê os valores',
  deliverable: 'Entrega',
  criterion: 'Critério',
  tasksDone: 'tarefas concluídas',
  today: 'hoje',
  tomorrow: 'amanhã',
  noValue: '—',
} as const

export const MILESTONE_STATUS_LABELS: Record<TrackingMilestoneStatus, string> = {
  done: 'Cumprido',
  at_risk: 'Em risco',
  on_track: 'No prazo',
}

/** Tom visual do estado: a cor é reforço, o texto e o ícone dizem o mesmo. */
export type MilestoneTone = 'done' | 'risk' | 'track'

export const MILESTONE_TONES: Record<TrackingMilestoneStatus, MilestoneTone> = {
  done: 'done',
  at_risk: 'risk',
  on_track: 'track',
}

/** Ícone de cada estado (aparece junto do texto). */
export const MILESTONE_GLYPHS: Record<TrackingMilestoneStatus, string> = {
  done: '✓',
  at_risk: '!',
  on_track: '●',
}

/** "semana 3 de 13", ou nulo quando o cronograma não tem intervalo de datas. */
export function weekText(week: TrackingWeek | null): string | null {
  return week === null ? null : `semana ${week.current} de ${week.total}`
}

/** Subtítulo do cabeçalho: "Projeto · semana N de M", sem as partes que faltam. */
export function headerSubtitle(projectName: string | null, week: TrackingWeek | null): string {
  return [projectName, weekText(week)].filter((part): part is string => Boolean(part)).join(' · ')
}

/** Número com vírgula e até uma casa, no formato pt-BR. */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** "214 h" e "de 590 h previstas". */
export function hoursValue(logged: number): string {
  return `${formatNumber(logged)} h`
}

export function hoursCaption(planned: number): string {
  return `de ${formatNumber(planned)} h previstas`
}

/** Custo realizado, ou "—" quando quem lê não é gestor (valor nulo). */
export function costValue(realized: number | null): string {
  return realized === null ? trackingCopy.noValue : formatBRL(Math.round(realized * 100))
}

/** "de R$ 26.550,00 previstos", ou "—" sem valor. */
export function costCaption(planned: number | null): string {
  return planned === null
    ? trackingCopy.noValue
    : `de ${formatBRL(Math.round(planned * 100))} previstos`
}

/** Dias até o marco em palavras: "hoje", "amanhã", "em 31 dias". */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return trackingCopy.today
  if (daysLeft === 1) return trackingCopy.tomorrow
  return `em ${daysLeft} dias`
}

/** Data curta do marco com os dias: "qui 18/12 · em 31 dias". */
export function nextMilestoneWhen(dueOn: string, daysLeft: number): string {
  return `${shortDateLabel(dueOn)} · ${daysLeftLabel(daysLeft)}`
}

/** Concluído de 0 a 100, com o texto "X de Y tarefas concluídas". */
export function progressCaption(done: number, total: number): string {
  return `${done} de ${total} ${trackingCopy.tasksDone}`
}
