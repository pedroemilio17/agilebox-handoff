import type { FlowMetricsViewDto } from '@agilebox/contract'

/**
 * Regras de exibição da tela "Métricas de fluxo". Funções puras: o servidor calcula lead time, cycle
 * time e vazão; aqui só se escolhe o texto e a geometria do gráfico SVG.
 */

/** Abaixo deste número de tarefas concluídas, a tela avisa que a amostra é pequena. */
export const SMALL_SAMPLE = 5

export const flowMetricsCopy = {
  title: 'Métricas de fluxo',
  noProject: 'Escolha um projeto para ver as métricas de fluxo.',
  loading: 'Carregando as métricas de fluxo…',
  loadError: 'Não foi possível carregar as métricas de fluxo deste projeto.',
  retry: 'Tentar de novo',
  emptyTitle: 'Nenhuma tarefa concluída nas últimas 8 semanas.',
  windowLabel: 'Últimas 8 semanas',
  leadTime: 'Lead time médio',
  cycleTime: 'Cycle time médio',
  throughput: 'Vazão',
  leadCaption: 'da criação até a conclusão',
  cycleCaption: 'do primeiro início até a conclusão',
  noCycle: 'Nenhuma tarefa concluída com início registrado.',
  throughputCaption: (perWeek: string) => `média de ${perWeek} por semana`,
  sampleNote: (count: number) =>
    `Amostra pequena: ${count === 1 ? '1 tarefa concluída' : `${count} tarefas concluídas`} nas últimas 8 semanas. Os números ficam mais firmes com pelo menos ${SMALL_SAMPLE}.`,
  chartLabel: 'Tarefas concluídas por semana',
  chartTableSummary: 'Ver os valores semana a semana',
  week: 'Semana',
  completed: 'Concluídas',
  noValue: '—',
} as const

export const CHART = { width: 640, height: 220, left: 40, right: 12, top: 16, bottom: 32 } as const

/** "09/11" a partir de "2026-11-09". */
export function dayLabel(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** Número inteiro no formato pt-BR. */
export function formatCount(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** "4,2 dias", "1 dia", "—" sem valor. Arredonda para uma casa decimal. */
export function formatDays(value: number | null): string {
  if (value === null) return flowMetricsCopy.noValue
  const rounded = Math.round(value * 10) / 10
  if (rounded === 1) return '1 dia'
  return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

/** Média por semana com uma casa decimal, a partir do total de tarefas da janela. */
export function perWeekText(completed: number, weeks: number): string {
  const average = Math.round((completed / weeks) * 10) / 10
  return average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** Dia anterior a uma data `YYYY-MM-DD` (o fim da janela é exclusivo). */
function previousDay(date: string): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

/** Subtítulo: "Últimas 8 semanas · 10/11 a 04/01". */
export function headerSubtitle(view: FlowMetricsViewDto): string {
  return `${flowMetricsCopy.windowLabel} · ${dayLabel(view.windowStart)} a ${dayLabel(previousDay(view.windowEnd))}`
}

/** Escala do eixo: passo "redondo" e domínio que cabe o maior valor, sem zero no topo vazio. */
export function yScale(max: number): { readonly domain: number; readonly step: number } {
  const top = Math.max(1, max)
  const step = Math.max(1, Math.ceil(top / 4))
  return { domain: step * Math.ceil(top / step), step }
}

export interface FlowBar {
  readonly start: string
  readonly completed: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly label: string
}

export interface FlowChart {
  readonly ticks: readonly { readonly value: number; readonly y: number }[]
  readonly bars: readonly FlowBar[]
}

/** Geometria do gráfico de barras: uma barra por semana, da mais antiga para a atual. */
export function flowChart(view: FlowMetricsViewDto): FlowChart {
  const max = Math.max(0, ...view.weeks.map((week) => week.completed))
  const { domain, step } = yScale(max)
  const innerWidth = CHART.width - CHART.left - CHART.right
  const innerHeight = CHART.height - CHART.top - CHART.bottom
  const slot = view.weeks.length ? innerWidth / view.weeks.length : innerWidth
  const barWidth = slot * 0.6
  const yOf = (value: number) => CHART.top + innerHeight - (value / domain) * innerHeight
  const ticks: { value: number; y: number }[] = []
  for (let value = 0; value <= domain; value += step) ticks.push({ value, y: yOf(value) })
  const bars = view.weeks.map((week, index) => {
    const height = (week.completed / domain) * innerHeight
    return {
      start: week.start,
      completed: week.completed,
      x: CHART.left + index * slot + (slot - barWidth) / 2,
      y: CHART.top + innerHeight - height,
      width: barWidth,
      height,
      label: dayLabel(week.start),
    }
  })
  return { ticks, bars }
}

/**
 * Resumo em texto do gráfico, para leitor de tela e para quem não vê o gráfico: as contagens semana a
 * semana e os números do topo.
 */
export function flowSummary(view: FlowMetricsViewDto): string {
  const weeks = view.weeks.map((week) => `${dayLabel(week.start)}: ${week.completed}`).join('; ')
  const total = `${view.completed} ${view.completed === 1 ? 'tarefa concluída' : 'tarefas concluídas'} nas últimas 8 semanas`
  const lead = view.leadDays === null ? '' : ` Lead time médio de ${formatDays(view.leadDays)}.`
  const cycle = view.cycleDays === null ? '' : ` Cycle time médio de ${formatDays(view.cycleDays)}.`
  return `Concluídas por semana, ${weeks}. Total de ${total}.${lead}${cycle}`
}
