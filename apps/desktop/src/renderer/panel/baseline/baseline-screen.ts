import { formatBRL } from '@agilebox/core'
import type { BaselineStatus, BaselineTaskDto } from '@agilebox/contract'
import { shortDateLabel } from '../milestones/milestone-rules'
import { formatNumber } from '../tracking/tracking-screen'

/**
 * Regras de exibição da tela "Linha de base". Funções puras: o servidor calcula os desvios e o
 * resumo; aqui só se escolhe o texto, o tom e a forma de mostrar cada valor. Estado sempre com
 * texto e ícone, nunca só com a cor.
 */

export const baselineCopy = {
  title: 'Linha de base',
  noProject: 'Escolha um projeto para ver a linha de base.',
  loading: 'Carregando a linha de base…',
  loadError: 'Não foi possível carregar a linha de base deste projeto.',
  retry: 'Tentar de novo',
  takeFirst: 'Tirar a primeira foto',
  takeNew: 'Tirar nova foto',
  takeQuestion: 'Tirar a foto agora? A comparação passa a usar a foto nova.',
  takeYes: 'Sim, tirar foto',
  takeNo: 'Cancelar',
  taking: 'Tirando a foto…',
  takeError: 'Não foi possível tirar a foto. Tente de novo.',
  emptyTitle: 'Nenhuma linha de base ainda',
  emptyDescription:
    'Tire a foto quando o plano estiver combinado. Ela guarda as datas, as horas e o custo desse dia, para comparar depois com o que aconteceu.',
  plannedEnd: 'Fim planejado',
  currentEnd: 'Fim atual',
  deviation: 'Desvio em dias',
  deviationOnTime: 'No prazo',
  deviationLate: 'Fim atrasado',
  deviationEarly: 'Fim adiantado',
  deviationNoDates: 'Sem datas para comparar',
  hours: 'Horas',
  hoursPlanned: 'planejado',
  cost: 'Custo',
  costPlanned: 'planejado',
  costOnlyManager: 'Só o gestor vê os valores',
  tasks: 'Desvios por tarefa',
  tasksList: 'Lista de desvios por tarefa',
  noTasks: 'Nenhuma tarefa com data na foto.',
  columns: {
    task: 'Tarefa',
    status: 'Situação',
    plannedEnd: 'Fim planejado',
    currentEnd: 'Fim atual',
    hours: 'Horas',
    cost: 'Custo',
  },
  takenBy: 'Foto tirada',
  noValue: '—',
  unknownTaker: 'alguém da equipe',
} as const

export const BASELINE_STATUS_LABELS: Record<BaselineStatus, string> = {
  on_time: 'No prazo',
  late: 'Atrasada',
  new: 'Nova',
  removed: 'Removida',
}

/** Tom visual da situação. A cor reforça; o texto e o ícone dizem o mesmo. */
export type BaselineTone = 'track' | 'risk' | 'new' | 'muted'

export const BASELINE_TONES: Record<BaselineStatus, BaselineTone> = {
  on_time: 'track',
  late: 'risk',
  new: 'new',
  removed: 'muted',
}

/** Ícone de cada situação (aparece junto do texto). */
export const BASELINE_GLYPHS: Record<BaselineStatus, string> = {
  on_time: '●',
  late: '!',
  new: '+',
  removed: '×',
}

/** "Atrasada 3 d", "No prazo", "Nova" ou "Removida". O atraso aparece no texto, não só na cor. */
export function statusText(row: Pick<BaselineTaskDto, 'status' | 'delayDays'>): string {
  if (row.status === 'late' && row.delayDays !== null) return `Atrasada ${row.delayDays} d`
  return BASELINE_STATUS_LABELS[row.status]
}

/** Dias com sinal: "+3 d", "−2 d", "0 d". Sem comparação, "—". */
export function signedDays(days: number | null): string {
  if (days === null) return baselineCopy.noValue
  if (days === 0) return '0 d'
  return `${days > 0 ? '+' : '−'}${Math.abs(days)} d`
}

/** Valor do cartão "Desvio em dias": o número com sinal e a leitura em palavras ao lado. */
export function deviationCaption(days: number | null): string {
  if (days === null) return baselineCopy.deviationNoDates
  if (days > 0) return baselineCopy.deviationLate
  if (days < 0) return baselineCopy.deviationEarly
  return baselineCopy.deviationOnTime
}

/** Horas com sinal, no formato pt-BR: "+2 h", "−1 h", "0 h". Sem comparação, "—". */
export function signedHours(hours: number | null): string {
  if (hours === null) return baselineCopy.noValue
  if (hours === 0) return '0 h'
  return `${hours > 0 ? '+' : '−'}${formatNumber(Math.abs(hours))} h`
}

/** Reais com sinal: "+R$ 90,00", "−R$ 10,00". Sem valor, "—". */
export function signedMoney(reais: number | null): string {
  if (reais === null) return baselineCopy.noValue
  const cents = Math.round(Math.abs(reais) * 100)
  if (cents === 0) return formatBRL(0)
  return `${reais > 0 ? '+' : '−'}${formatBRL(cents)}`
}

/** Valor em reais, ou "—" quando quem lê não vê valores. */
export function moneyValue(reais: number | null): string {
  return reais === null ? baselineCopy.noValue : formatBRL(Math.round(reais * 100))
}

/** Horas num texto só: "46 h". */
export function hoursValue(hours: number): string {
  return `${formatNumber(hours)} h`
}

/** Data curta do cronograma, ou "—" sem data. */
export function dateText(dueOn: string | null): string {
  return dueOn === null ? baselineCopy.noValue : shortDateLabel(dueOn)
}

/** Data e hora da foto no fuso local: "18/11/2026, 02:15". */
export function takenAtLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return baselineCopy.noValue
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "Foto tirada em 18/11/2026, 02:15 por Gestora", sem a parte que falta. */
export function takenByText(takenAt: string, takenByName: string | null): string {
  const who = takenByName ?? baselineCopy.unknownTaker
  return `${baselineCopy.takenBy} em ${takenAtLabel(takenAt)} por ${who}`
}
