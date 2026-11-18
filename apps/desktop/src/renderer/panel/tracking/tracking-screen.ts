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
  noOutsideBaseline: 'Nenhuma tarefa fora da base.',
  noBaseline: 'Nenhuma linha de base ainda.',
  takenBy: 'Tirada em',
  takenFallback: 'sem nome',
  baseline: 'Linha de base',
  takeBaseline: 'Tirar nova foto',
  risks: 'Riscos',
  newRisk: 'Novo risco',
  noRisks: 'Nenhum risco cadastrado.',
  riskResponse: 'Resposta',
  noResponse: 'Sem resposta definida',
  riskMatrixLabel: 'Matriz de riscos por probabilidade e impacto',
  riskListLabel: 'Lista de riscos',
  noOwner: 'Sem dono',
  probabilityRows: ['Prob. alta', 'média', 'baixa'],
  impactColumns: ['Impacto baixo', 'médio', 'alto'],
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

/** "214 h" e "de 590 h previstas no projeto". */
export function hoursValue(logged: number): string {
  return `${formatNumber(logged)} h`
}

export function hoursCaption(planned: number): string {
  return `de ${formatNumber(planned)} h previstas no projeto`
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

/** Código curto do risco na matriz e na lista: "R1", "R2"... pela posição na ordem da pontuação. */
export function riskCode(index: number): string {
  return `R${index + 1}`
}

/**
 * Nível de calor da célula da matriz (0 a 3) a partir da pontuação probabilidade × impacto: 9 é o
 * mais quente, 1 e 2 ficam sem cor. A cor é reforço; a lista traz a faixa em texto.
 */
export function riskHeat(score: number): 0 | 1 | 2 | 3 {
  if (score >= 9) return 3
  if (score >= 6) return 2
  if (score >= 3) return 1
  return 0
}

/** Dia e mês do momento da foto, no fuso do computador: "03/11". */
export function takenDayMonth(takenAt: string): string {
  const date = new Date(takenAt)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/**
 * Frase das tarefas fora da linha de base: "1 tarefa fora da base: Integração bancária, +7 dias.".
 * Sem nenhuma atrasada, diz isso.
 */
export function outsideBaselineText(
  late: readonly { readonly title: string; readonly delayDays: number | null }[],
): string {
  if (late.length === 0) return trackingCopy.noOutsideBaseline
  const count = late.length === 1 ? 'tarefa fora da base' : 'tarefas fora da base'
  const items = late
    .map((task) => {
      const days = task.delayDays ?? 0
      return `${task.title}, +${days} ${days === 1 ? 'dia' : 'dias'}`
    })
    .join('; ')
  return `${late.length} ${count}: ${items}.`
}
