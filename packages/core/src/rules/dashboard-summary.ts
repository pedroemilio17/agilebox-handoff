import { ValidationError } from '../shared/errors'
import { addDays, parseDateOnly } from '../values/date-only'
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '../values/task-status'

/**
 * Formatação do resumo do dashboard (B11). Não recalcula regra nenhuma: usa só os números que o
 * dashboard já recebe em `insights`. Custo e valores/hora não entram (não são mostrados no dashboard).
 */

export interface DashboardSummaryWeek {
  readonly start: string
  readonly throughput: number
  readonly cycleDays?: number | null | undefined
  readonly leadDays?: number | null | undefined
  readonly upToDatePercentage?: number | null | undefined
}

export interface DashboardSummaryPerson {
  readonly user: { readonly name: string }
  readonly taskCount: number
  readonly completedPercentage: number
  readonly inProgress: number
  readonly agingCount: number
  readonly overdueCount: number
  readonly blockedCount: number
  readonly lastUpdatedAt: string | null
}

export interface DashboardSummaryInsights {
  readonly updatedAt: string
  readonly weekStart: string
  readonly upToDatePercentage: number | null
  readonly agingCount: number
  readonly overdueCount: number
  readonly blockedCount: number
  readonly overWipColumns: readonly {
    readonly status: TaskStatus
    readonly count: number
    readonly limit: number
  }[]
  readonly cycleDays: number | null
  readonly leadDays: number | null
  readonly throughput: number
  readonly weeks: readonly DashboardSummaryWeek[]
  readonly team: readonly DashboardSummaryPerson[]
}

export interface DashboardSummaryOptions {
  readonly generatedAt: string
  readonly periodLabel: string
  readonly organizationName: string
  readonly timeZone: string
}

export const DASHBOARD_SUMMARY_TITLE = 'Resumo do time'
export const DASHBOARD_SUMMARY_EMPTY = '—'
const CSV_HEADER = [
  'Nome',
  'Itens',
  'Concluído %',
  'Paradas',
  'Vencidas',
  'Bloqueadas',
  'Última atualização',
] as const

/**
 * Devolve o dashboard com os indicadores da semana escolhida nos campos de topo (adesão, ciclo,
 * lead time e vazão), que é o que a tela mostra quando há seletor de semana.
 */
export function selectDashboardPeriod(
  insights: DashboardSummaryInsights,
  weekStart: string,
): DashboardSummaryInsights {
  const week = insights.weeks.find((item) => item.start === weekStart)
  if (!week) throw new ValidationError('Semana fora do dashboard')
  return {
    ...insights,
    weekStart: week.start,
    upToDatePercentage: week.upToDatePercentage ?? null,
    cycleDays: week.cycleDays ?? null,
    leadDays: week.leadDays ?? null,
    throughput: week.throughput,
  }
}

/** Rótulo do período no padrão do seletor: "Semana 45 · 03/11–09/11/2026". */
export function formatDashboardPeriodLabel(weekStart: string): string {
  const start = parseDateOnly(weekStart)
  const end = addDays(start, 6)
  const dayMonth = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`
  return `Semana ${isoWeekNumber(start)} · ${dayMonth(start)}–${dayMonth(end)}/${end.slice(0, 4)}`
}

/** Número da semana ISO (a semana que contém a quinta-feira). */
export function isoWeekNumber(date: string): number {
  const value = new Date(`${parseDateOnly(date)}T00:00:00Z`)
  const day = (value.getUTCDay() + 6) % 7
  value.setUTCDate(value.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(value.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((value.getTime() - firstThursday.getTime()) / 604_800_000)
}

export function renderDashboardSummary(
  insights: DashboardSummaryInsights,
  options: DashboardSummaryOptions,
): string {
  const lines = [
    `# ${DASHBOARD_SUMMARY_TITLE}`,
    '',
    `- **Organização:** ${orDash(options.organizationName)}`,
    `- **Gerado em:** ${formatDateTime(options.generatedAt, options.timeZone)}`,
    `- **Período:** ${orDash(options.periodLabel)}`,
    '',
    '## Adesão',
    '',
    `Quadro em dia: **${percent(insights.upToDatePercentage)}** das tarefas ativas foram atualizadas nas últimas 48h.`,
    '',
    '## Exceções',
    '',
    `- Paradas (há mais de 4 dias em Desenvolvendo ou Revisar): ${insights.agingCount}`,
    `- Vencidas (prazo de entrega passou): ${insights.overdueCount}`,
    `- Bloqueadas (com motivo registrado): ${insights.blockedCount}`,
    `- Colunas acima do limite de WIP: ${overWipText(insights)}`,
    '',
    '## Fluxo semanal',
    '',
    `- Tempo de ciclo médio: ${days(insights.cycleDays)}`,
    `- Do pedido à entrega (lead time): ${days(insights.leadDays)}`,
    `- Concluídas nesta semana: ${insights.throughput}`,
    '',
    '| Semana | Início | Concluídas | Ciclo médio | Lead time | Quadro em dia |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...insights.weeks.map(
      (week) =>
        `| ${isoWeekNumber(week.start)} | ${dayMonth(week.start)} | ${week.throughput} | ${days(week.cycleDays ?? null)} | ${days(week.leadDays ?? null)} | ${percent(week.upToDatePercentage ?? null)} |`,
    ),
    '',
    '## Equipe',
    '',
  ]
  const team = sortedTeam(insights.team)
  if (team.length === 0) {
    lines.push('Nenhuma tarefa ainda.')
  } else {
    lines.push(
      '| Pessoa | Itens | Concluído | Paradas | Vencidas | Bloqueadas | Última atualização |',
      '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
      ...team.map(
        (person) =>
          `| ${cell(person.user.name)} | ${person.taskCount} | ${percent(person.completedPercentage)} | ${person.agingCount} | ${person.overdueCount} | ${person.blockedCount} | ${cell(formatOptionalDateTime(person.lastUpdatedAt, options.timeZone))} |`,
      ),
    )
  }
  return `${lines.join('\n')}\n`
}

/** Uma linha por pessoa, na mesma ordem da planilha. BOM UTF-8 opcional, para o Excel reconhecer acentos. */
export function renderDashboardSummaryCsv(
  insights: DashboardSummaryInsights,
  options: { readonly timeZone: string; readonly bom?: boolean },
): string {
  const rows = sortedTeam(insights.team).map((person) => [
    csvTextCell(person.user.name),
    ...[
      String(person.taskCount),
      String(person.completedPercentage),
      String(person.agingCount),
      String(person.overdueCount),
      String(person.blockedCount),
      formatOptionalDateTime(person.lastUpdatedAt, options.timeZone),
    ].map(csvCell),
  ])
  const body = [CSV_HEADER.map(csvCell), ...rows].map((row) => row.join(',')).join('\r\n')
  return `${options.bom ? '﻿' : ''}${body}\r\n`
}

/** Escapa um campo CSV (RFC 4180): aspas quando há vírgula, aspas ou quebra de linha; aspas dobradas. */
export function csvCell(value: string): string {
  const text = value.trim() === '' ? DASHBOARD_SUMMARY_EMPTY : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Campo de TEXTO livre no CSV: neutraliza injeção de fórmula (OWASP) antes do escape de CSV. */
export function csvTextCell(value: string): string {
  return csvCell(neutralizeFormula(value))
}

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/** Prefixa com apóstrofo um texto que o Excel/Planilhas leriam como fórmula. Vazio e números ficam intactos. */
function neutralizeFormula(value: string): string {
  return value !== '' && FORMULA_TRIGGERS.includes(value.charAt(0)) ? `'${value}` : value
}

function cell(value: string): string {
  const text = value.trim() === '' ? DASHBOARD_SUMMARY_EMPTY : value
  return text.replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ')
}

function orDash(value: string): string {
  return value.trim() === '' ? DASHBOARD_SUMMARY_EMPTY : value
}

function sortedTeam(team: readonly DashboardSummaryPerson[]): DashboardSummaryPerson[] {
  return [...team].sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR'))
}

function overWipText(insights: DashboardSummaryInsights): string {
  if (insights.overWipColumns.length === 0) return 'nenhuma'
  return [...insights.overWipColumns]
    .sort((a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status))
    .map((column) => `${TASK_STATUS_LABELS[column.status]} (${column.count}/${column.limit})`)
    .join('; ')
}

function percent(value: number | null): string {
  return value === null ? DASHBOARD_SUMMARY_EMPTY : `${Math.round(value)}%`
}

function days(value: number | null): string {
  return value === null
    ? DASHBOARD_SUMMARY_EMPTY
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d`
}

function dayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

function formatOptionalDateTime(iso: string | null, timeZone: string): string {
  return iso === null ? DASHBOARD_SUMMARY_EMPTY : formatDateTime(iso, timeZone)
}

/** Data e hora no fuso informado: "04/11/2026 14:26". */
function formatDateTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`
}
