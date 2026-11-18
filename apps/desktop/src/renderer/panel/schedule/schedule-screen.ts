import type {
  ScheduleDependencyDto,
  ScheduleMilestoneDto,
  ScheduleTaskDto,
  WbsViewDto,
} from '@agilebox/contract'

/**
 * Regras de exibição do Cronograma (Gantt). Funções puras: sem DOM, sem API. O servidor calcula o
 * conflito de dependências e valida as datas; aqui só se decide escala, posição, agrupamento e texto.
 */

export type ScheduleScale = 'weeks' | 'months'

const DAY_MS = 86_400_000
const MONTH_NAMES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/** Dia como número inteiro (dias desde 1970-01-01, em UTC). Evita fuso e horário de verão. */
export function dayNumberOf(iso: string): number {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/** Volta de dia numérico para `AAAA-MM-DD`. */
export function isoOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** Segunda-feira da semana que contém o dia (semana começa na segunda). */
function mondayOnOrBefore(day: number): number {
  const weekday = new Date(day * DAY_MS).getUTCDay()
  return day - ((weekday + 6) % 7)
}

function firstOfMonth(day: number): number {
  const date = new Date(day * DAY_MS)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / DAY_MS
}

function addMonths(day: number, months: number): number {
  const date = new Date(day * DAY_MS)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1) / DAY_MS
}

/** "dd/mm" para exibição e rótulos. */
export function shortDate(iso: string): string {
  const [, month = '01', day = '01'] = iso.split('-')
  return `${day}/${month}`
}

export interface TimeColumn {
  /** Primeiro dia da coluna (inclusive). */
  readonly start: number
  /** Fim da coluna (exclusivo). */
  readonly end: number
  readonly label: string
}

export interface TimeScale {
  readonly scale: ScheduleScale
  readonly start: number
  readonly end: number
  readonly columns: readonly TimeColumn[]
  /** Posição de um dia (`AAAA-MM-DD`) no eixo, de 0 a 1, sem sair do intervalo. */
  readonly pos: (iso: string) => number
  /** Posição do centro do dia no eixo; `null` quando o dia cai fora do eixo. */
  readonly centerOf: (iso: string) => number | null
  /** Posição e largura de uma barra de início a prazo (prazo incluído). */
  readonly barGeometry: (startsOn: string, deadline: string) => { left: number; width: number }
}

/**
 * Escala do eixo a partir do intervalo das tarefas, com uma margem: uma semana nas semanas e um mês
 * nos meses. Semanas começam na segunda; cada coluna é uma semana ou um mês.
 */
export function buildTimeScale(
  range: { readonly start: string; readonly end: string },
  scale: ScheduleScale,
): TimeScale {
  const rangeStart = dayNumberOf(range.start)
  const rangeEnd = dayNumberOf(range.end)
  const columns: TimeColumn[] = []
  let start: number
  let end: number
  if (scale === 'weeks') {
    start = mondayOnOrBefore(rangeStart) - 7
    end = mondayOnOrBefore(rangeEnd) + 14
    for (let day = start; day < end; day += 7) {
      columns.push({ start: day, end: day + 7, label: shortDate(isoOfDay(day)) })
    }
  } else {
    start = addMonths(firstOfMonth(rangeStart), -1)
    end = addMonths(firstOfMonth(rangeEnd), 2)
    for (let day = start; day < end; day = addMonths(day, 1)) {
      const next = addMonths(day, 1)
      const date = new Date(day * DAY_MS)
      const year = String(date.getUTCFullYear() % 100).padStart(2, '0')
      columns.push({
        start: day,
        end: next,
        label: `${MONTH_NAMES[date.getUTCMonth()] ?? ''}/${year}`,
      })
    }
  }
  const span = end - start
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  const pos = (iso: string) => clamp((dayNumberOf(iso) - start) / span)
  const centerOf = (iso: string) => {
    const day = dayNumberOf(iso)
    if (day < start || day >= end) return null
    return (day + 0.5 - start) / span
  }
  const barGeometry = (startsOn: string, deadline: string) => {
    const left = pos(startsOn)
    const right = clamp((dayNumberOf(deadline) + 1 - start) / span)
    return { left, width: Math.max(0, right - left) }
  }
  return { scale, start, end, columns, pos, centerOf, barGeometry }
}

/** Tarefa com as duas datas: só ela tem barra no Gantt e liga dependências. */
export function hasBar(task: ScheduleTaskDto): task is ScheduleTaskDto & {
  startsOn: string
  deadline: string
} {
  return task.startsOn !== null && task.deadline !== null
}

export type BarState = 'done' | 'late' | 'current' | 'future'

/**
 * Estado da barra: concluída; atrasada (prazo passou e não está concluída); em andamento (hoje entre
 * início e prazo); futura (o resto). Sem as duas datas, não há estado.
 */
export function barState(task: ScheduleTaskDto, today: string): BarState | null {
  if (!hasBar(task)) return null
  if (task.done) return 'done'
  if (task.deadline < today) return 'late'
  if (task.startsOn <= today && today <= task.deadline) return 'current'
  return 'future'
}

export const BAR_STATE_LABELS: Record<BarState, string> = {
  done: 'Concluída',
  late: 'Atrasada',
  current: 'Em andamento',
  future: 'Futura',
}

/** Rótulo da barra para `title` e `aria-label`: "Nome da tarefa: início dd/mm, prazo dd/mm". */
export function barLabel(task: ScheduleTaskDto): string {
  if (!hasBar(task)) return `${task.title}: sem datas`
  return `${task.title}: início ${shortDate(task.startsOn)}, prazo ${shortDate(task.deadline)}`
}

/** Texto das datas na lista: "02/11 → 30/01", ou "sem datas" quando falta alguma. */
export function datesText(task: ScheduleTaskDto): string {
  if (!hasBar(task)) return 'sem datas'
  return `${shortDate(task.startsOn)} → ${shortDate(task.deadline)}`
}

export interface ScheduleGroup {
  readonly key: string
  /** Título da entrega, ou nulo quando a lista é plana (sem EAP ligada). */
  readonly title: string | null
  readonly code: string | null
  readonly tasks: readonly ScheduleTaskDto[]
}

/** Tarefas com data primeiro, pela data de início; sem data ao final; desempate pela chave. */
export function compareTasks(a: ScheduleTaskDto, b: ScheduleTaskDto): number {
  const startA = a.startsOn ?? '9999-12-31'
  const startB = b.startsOn ?? '9999-12-31'
  if (startA !== startB) return startA < startB ? -1 : 1
  return a.key.localeCompare(b.key)
}

/**
 * Agrupa as tarefas por entrega. Com a EAP, a ordem é a da EAP, entregas sem tarefas ficam de fora e
 * as tarefas sem entrega vão ao final em "Sem entrega". Sem a EAP, uma lista plana por início.
 */
export function groupTasks(tasks: readonly ScheduleTaskDto[], wbs?: WbsViewDto): ScheduleGroup[] {
  const sorted = [...tasks].sort(compareTasks)
  // Sem entregas cadastradas, agrupar só repetiria "Sem entrega" em todas as linhas: fica plano.
  const deliverables = wbs?.deliverables.filter((row) => row.kind === 'deliverable') ?? []
  if (wbs === undefined || deliverables.length === 0) {
    return sorted.length === 0 ? [] : [{ key: 'flat', title: null, code: null, tasks: sorted }]
  }
  const groups: ScheduleGroup[] = []
  const known = new Set<string>()
  for (const row of deliverables) {
    if (row.kind !== 'deliverable') continue
    known.add(row.id)
    const own = sorted.filter((task) => task.deliverableId === row.id)
    if (own.length > 0) {
      groups.push({ key: row.id, title: row.title, code: row.code, tasks: own })
    }
  }
  const loose = sorted.filter(
    (task) => task.deliverableId === null || !known.has(task.deliverableId),
  )
  if (loose.length > 0) {
    groups.push({ key: 'none', title: 'Sem entrega', code: null, tasks: loose })
  }
  return groups
}

export type ScheduleRow =
  | {
      readonly kind: 'group'
      readonly index: number
      readonly key: string
      readonly title: string
      readonly code: string | null
    }
  | {
      readonly kind: 'task'
      readonly index: number
      readonly task: ScheduleTaskDto
      /** Tarefa recuada sob o nome da entrega. */
      readonly indented: boolean
    }
  | {
      readonly kind: 'milestone'
      readonly index: number
      readonly milestone: ScheduleMilestoneDto
    }

/**
 * Linhas do Gantt na ordem de exibição: cabeçalho de cada entrega, suas tarefas e, por último, o
 * grupo "Marcos". Cada linha tem o índice vertical usado pelas setas.
 */
export function buildRows(
  groups: readonly ScheduleGroup[],
  milestones: readonly ScheduleMilestoneDto[],
): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (const group of groups) {
    const grouped = group.title !== null
    if (group.title !== null) {
      rows.push({
        kind: 'group',
        index: rows.length,
        key: group.key,
        title: group.title,
        code: group.code,
      })
    }
    for (const task of group.tasks) {
      rows.push({ kind: 'task', index: rows.length, task, indented: grouped })
    }
  }
  if (milestones.length > 0) {
    rows.push({ kind: 'group', index: rows.length, key: 'milestones', title: 'Marcos', code: null })
    for (const milestone of milestones) {
      rows.push({ kind: 'milestone', index: rows.length, milestone })
    }
  }
  return rows
}

/** Posição do losango de marco no eixo; `null` quando a data cai fora do eixo. */
export function milestoneCenter(milestone: ScheduleMilestoneDto, scale: TimeScale): number | null {
  return scale.centerOf(milestone.dueOn)
}

/** Posição do traço "hoje" no eixo; fora do intervalo, não desenha (`null`). */
export function todayCenter(today: string, scale: TimeScale): number | null {
  return scale.centerOf(today)
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface DependencyLine {
  readonly predecessorId: string
  readonly successorId: string
  readonly conflict: boolean
  /** Ângulos retos do fim da predecessora ao início da sucessora. `x` de 0 a 1; `y` é o índice da linha. */
  readonly points: readonly [Point, Point, Point, Point]
}

/**
 * Linhas de dependência entre tarefas com barra. `x` é fração da largura do eixo e `y` é o índice da
 * linha (o centro da linha fica em índice + 0,5). Dependência com tarefa sem barra não é desenhada.
 */
export function dependencyLines(
  dependencies: readonly ScheduleDependencyDto[],
  rows: readonly ScheduleRow[],
  scale: TimeScale,
): DependencyLine[] {
  const rowOf = new Map<string, { index: number; task: ScheduleTaskDto }>()
  for (const row of rows) {
    if (row.kind === 'task') rowOf.set(row.task.taskId, { index: row.index, task: row.task })
  }
  const lines: DependencyLine[] = []
  for (const dependency of dependencies) {
    const predecessor = rowOf.get(dependency.predecessorId)
    const successor = rowOf.get(dependency.successorId)
    if (!predecessor || !successor) continue
    if (!hasBar(predecessor.task) || !hasBar(successor.task)) continue
    const bar = scale.barGeometry(predecessor.task.startsOn, predecessor.task.deadline)
    const x1 = bar.left + bar.width
    const x2 = scale.pos(successor.task.startsOn)
    const y1 = predecessor.index + 0.5
    const y2 = successor.index + 0.5
    const xm = (x1 + x2) / 2
    lines.push({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      conflict: dependency.conflict,
      points: [
        { x: x1, y: y1 },
        { x: xm, y: y1 },
        { x: xm, y: y2 },
        { x: x2, y: y2 },
      ],
    })
  }
  return lines
}

/** Texto do alerta de conflitos, ou nulo quando não há conflito. */
export function conflictSummary(
  dependencies: readonly ScheduleDependencyDto[],
  tasks: readonly ScheduleTaskDto[],
): string | null {
  const conflicts = dependencies.filter((dependency) => dependency.conflict)
  if (conflicts.length === 0) return null
  const nameOf = (taskId: string) => tasks.find((task) => task.taskId === taskId)?.title ?? 'tarefa'
  const first = conflicts[0]!
  const head =
    conflicts.length === 1
      ? '1 dependência com conflito'
      : `${conflicts.length} dependências com conflito`
  return `${head}: ${nameOf(first.predecessorId)} termina depois do início de ${nameOf(first.successorId)}`
}

/** Escala escolhida: os rótulos dos botões Semanas | Meses. */
export const SCALE_LABELS: Record<ScheduleScale, string> = {
  weeks: 'Semanas',
  months: 'Meses',
}

/** Largura de um dia no eixo, em pixels (só layout). Cada coluna ocupa os dias que tem. */
export const DAY_WIDTH: Record<ScheduleScale, number> = {
  weeks: 8,
  months: 4,
}

/** Altura de cada linha do Gantt e largura da coluna de nomes, em pixels (só layout). */
export const ROW_HEIGHT = 40
export const NAME_COLUMN_WIDTH = 280

/** "dd/mm/aaaa" para o intervalo do cabeçalho. */
export function fullDate(iso: string): string {
  const [year = '1970', month = '01', day = '01'] = iso.split('-')
  return `${day}/${month}/${year}`
}
