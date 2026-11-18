import type { BurndownDayDto, BurndownViewDto } from '@agilebox/contract'

/**
 * Regras de exibição da tela "Burndown e velocidade". Funções puras: o servidor calcula as horas, a
 * série e a velocidade; aqui só se escolhe o texto e a geometria do gráfico SVG.
 */

export const burndownCopy = {
  title: 'Burndown',
  noProject: 'Escolha um projeto para ver o burndown.',
  loading: 'Carregando o burndown…',
  loadError: 'Não foi possível carregar o burndown deste projeto.',
  retry: 'Tentar de novo',
  noSprint: 'Nenhuma sprint ativa ou encerrada.',
  remaining: 'Horas restantes',
  velocity: 'Velocidade média',
  noVelocity: 'Nenhuma sprint encerrada ainda.',
  velocityCaption: (count: number) =>
    count === 1 ? 'média de 1 sprint encerrada' : `média de ${count} sprints encerradas`,
  velocityList: 'Sprints encerradas usadas na média',
  unestimated: (count: number) =>
    count === 1
      ? '1 tarefa sem estimativa (conta zero)'
      : `${count} tarefas sem estimativa (contam zero)`,
  noScope: 'Nenhuma tarefa nesta sprint ainda.',
  chartLabel: 'Gráfico de burndown',
  chartTableSummary: 'Ver os valores dia a dia',
  day: 'Dia',
  ideal: 'Ideal',
  actual: 'Restante',
  idealLegend: 'Ideal',
  actualLegend: 'Restante',
  activeStatus: 'Ativa',
  closedStatus: 'Encerrada',
  noValue: '—',
} as const

/** Número com vírgula e até uma casa, no formato pt-BR. */
export function formatHours(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** "8 h", "—" sem valor. */
export function hoursText(value: number | null): string {
  return value === null ? burndownCopy.noValue : `${formatHours(value)} h`
}

/** "09/11" a partir de "2026-11-09". */
export function dayLabel(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** Subtítulo: "Sprint 4 · Ativa · 09/11 a 20/11". */
export function headerSubtitle(view: BurndownViewDto): string {
  const sprint = view.sprint
  if (!sprint) return ''
  const status = sprint.status === 'active' ? burndownCopy.activeStatus : burndownCopy.closedStatus
  return `Sprint ${sprint.number} · ${status} · ${dayLabel(sprint.plannedStart)} a ${dayLabel(sprint.plannedEnd)}`
}

/** Último dia da sprint que já chegou (até hoje). Antes do início, vale o primeiro dia. */
export function currentDayIndex(days: readonly BurndownDayDto[], today: string): number {
  let index = 0
  days.forEach((day, position) => {
    if (day.date <= today) index = position
  })
  return index
}

/**
 * Resumo em texto do gráfico, para leitor de tela e para quem não vê o gráfico. Compara o restante
 * com a linha ideal do dia atual.
 */
export function burndownSummary(view: BurndownViewDto): string {
  const sprint = view.sprint
  if (!sprint) return burndownCopy.noSprint
  const base = `Restam ${hoursText(view.remainingHours)} de ${hoursText(view.totalHours)} estimadas, com ${view.doneTasks} de ${view.scopeTasks} tarefas concluídas.`
  if (view.days.length === 0) return base
  const index = currentDayIndex(view.days, view.today)
  const day = view.days[index]
  if (!day || day.remainingHours === null) return base
  const comparison =
    day.remainingHours <= day.idealHours
      ? 'Está em dia ou à frente da linha ideal.'
      : `Está ${formatHours(Math.round((day.remainingHours - day.idealHours) * 10) / 10)} h acima da linha ideal.`
  return `${base} ${comparison}`
}

export const CHART = {
  width: 640,
  height: 260,
  left: 44,
  right: 16,
  top: 16,
  bottom: 36,
} as const

export interface ChartPoint {
  readonly x: number
  readonly y: number
}

/** Escala do eixo vertical: o total da sprint (nunca abaixo de 1 h, para o gráfico não ficar colapsado). */
export function yScaleMax(totalHours: number): number {
  return Math.max(totalHours, 1)
}

/** Posição de um dia no eixo horizontal (uma sprint de um dia fica no meio). */
export function xAt(index: number, count: number): number {
  const plotWidth = CHART.width - CHART.left - CHART.right
  if (count <= 1) return CHART.left + plotWidth / 2
  return CHART.left + (index * plotWidth) / (count - 1)
}

/** Posição de um valor de horas no eixo vertical (zero embaixo, máximo em cima). */
export function yAt(hours: number, max: number): number {
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  return CHART.top + plotHeight * (1 - hours / max)
}

/** Caminho SVG de uma linha. Pontos sem valor quebram a linha. */
export function linePath(points: readonly (ChartPoint | null)[]): string {
  let path = ''
  let drawing = false
  for (const point of points) {
    if (point === null) {
      drawing = false
      continue
    }
    path += `${drawing ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)} `
    drawing = true
  }
  return path.trim()
}

/** Pontos da linha ideal e do restante, um por dia. Restante nulo vira quebra. */
export function chartSeries(view: BurndownViewDto) {
  const max = yScaleMax(view.totalHours)
  const count = view.days.length
  const ideal = view.days.map((day, index) => ({
    x: xAt(index, count),
    y: yAt(day.idealHours, max),
  }))
  const actual = view.days.map((day, index) =>
    day.remainingHours === null ? null : { x: xAt(index, count), y: yAt(day.remainingHours, max) },
  )
  return {
    max,
    idealPath: linePath(ideal),
    actualPath: linePath(actual),
    actualPoints: actual,
    ticks: [0, max / 2, max].map((value) => ({ value, y: yAt(value, max) })),
    labels: view.days.map((day, index) => ({ label: dayLabel(day.date), x: xAt(index, count) })),
  }
}
