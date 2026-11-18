import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { SprintTask } from '../entities/sprint-task'
import type { TaskId } from '../shared/ids'
import type { TaskStatus } from '../values/task-status'
import { addDays, compareDateOnly, diffInDays, toDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'

/**
 * Burndown e velocidade (ADR-10, módulo `burndown`). Funções puras: a aplicação lê as sprints, as
 * linhas de sprint, as tarefas e a linha do tempo, e aqui se calcula a série diária e a velocidade.
 *
 * Decisões:
 * - Escopo: tarefas não arquivadas com alguma linha de sprint que não seja `removed` (sair da sprint
 *   antes do fim tira a tarefa do escopo).
 * - Estimativa: a estimativa atual da tarefa (não há histórico de estimativa por dia). Sem estimativa
 *   conta zero e é contada à parte, para a tela avisar.
 * - Dia de conclusão: o dia (no fuso) do último evento `status_changed` até aquele dia. A tarefa está
 *   concluída no fim do dia quando o estado vigente é `done`; reabrir devolve as horas ao restante.
 * - Velocidade: horas estimadas das tarefas do escopo concluídas até o fim do dia do encerramento.
 */

/** Quantas sprints encerradas entram na média de velocidade. */
export const VELOCITY_WINDOW = 3

export interface BurndownDay {
  readonly date: DateOnly
  /** Linha ideal: reta do total até zero no último dia da sprint. */
  readonly idealHours: number
  /** Horas estimadas abertas no fim do dia. Nulo depois de `measuredUntil`. */
  readonly remainingHours: number | null
}

export interface BurndownSeries {
  readonly days: readonly BurndownDay[]
  readonly totalHours: number
  /** Horas abertas no último dia medido (ou total, se nada foi medido ainda). */
  readonly remainingHours: number
  readonly scopeTasks: number
  readonly doneTasks: number
  /** Tarefas do escopo sem estimativa. Contam zero no gráfico. */
  readonly unestimatedTasks: number
}

export interface BurndownInput {
  /** Datas planejadas da sprint, início ≤ fim (inclusive nas duas pontas). */
  readonly plannedStart: DateOnly
  readonly plannedEnd: DateOnly
  /** Tarefas do escopo (ver `sprintScope`). */
  readonly scope: readonly Task[]
  /** Linha do tempo das tarefas do escopo. Eventos de outras tarefas são ignorados. */
  readonly events: readonly TimelineEvent[]
  /** Último dia com número real: hoje, ou o dia do encerramento se a sprint fechou antes. */
  readonly measuredUntil: DateOnly
  readonly timeZone: string
}

export interface VelocityPoint {
  readonly sprintNumber: number
  readonly hours: number
}

interface StatusPoint {
  readonly day: DateOnly
  readonly after: TaskStatus
  readonly before: TaskStatus
}

/** Tarefas do escopo da sprint: não arquivadas e com alguma linha que não seja `removed`. */
export function sprintScope(tasks: readonly Task[], rows: readonly SprintTask[]): Task[] {
  const ids = new Set<TaskId>(
    rows.filter((row) => row.outcome !== 'removed').map((row) => row.taskId),
  )
  return tasks.filter((task) => task.archivedAt === null && ids.has(task.id))
}

/** Mudanças de estado da tarefa, em ordem, com o dia (no fuso) de cada uma. */
function statusHistory(
  task: Task,
  events: readonly TimelineEvent[],
  timeZone: string,
): StatusPoint[] {
  type StatusChange = Extract<TimelineEvent, { readonly type: 'status_changed' }>
  return events
    .filter(
      (event): event is StatusChange => event.taskId === task.id && event.type === 'status_changed',
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((event) => ({
      day: toDateOnly(new Date(event.at), timeZone),
      before: event.payload.before,
      after: event.payload.after,
    }))
}

/**
 * Estado da tarefa no fim do dia. Sem nenhuma mudança, vale o estado atual. Antes da primeira
 * mudança, vale o `before` dela.
 */
function statusOnDay(task: Task, history: readonly StatusPoint[], day: DateOnly): TaskStatus {
  if (history.length === 0) return task.status
  let status = history[0]!.before
  for (const point of history) {
    if (compareDateOnly(point.day, day) > 0) break
    status = point.after
  }
  return status
}

/** Horas (em centésimos) das tarefas do escopo concluídas no fim do dia. */
function doneHundredthsOn(
  scope: readonly Task[],
  histories: ReadonlyMap<TaskId, readonly StatusPoint[]>,
  day: DateOnly,
): number {
  let total = 0
  for (const task of scope) {
    if (statusOnDay(task, histories.get(task.id) ?? [], day) === 'done')
      total += task.estimatedHoursHundredths ?? 0
  }
  return total
}

function hoursOf(hundredths: number): number {
  return Math.round(hundredths) / 100
}

/** Série do burndown: um ponto por dia da sprint, com a linha ideal e as horas abertas medidas. */
export function burndownSeries(input: BurndownInput): BurndownSeries {
  const histories = new Map<TaskId, readonly StatusPoint[]>(
    input.scope.map((task) => [task.id, statusHistory(task, input.events, input.timeZone)]),
  )
  const totalHundredths = input.scope.reduce(
    (sum, task) => sum + (task.estimatedHoursHundredths ?? 0),
    0,
  )
  const dayCount = Math.max(1, diffInDays(input.plannedStart, input.plannedEnd) + 1)
  const days: BurndownDay[] = []
  for (let index = 0; index < dayCount; index++) {
    const date = addDays(input.plannedStart, index)
    const measured = compareDateOnly(date, input.measuredUntil) <= 0
    const remaining = measured
      ? hoursOf(totalHundredths - doneHundredthsOn(input.scope, histories, date))
      : null
    const ideal = dayCount === 1 ? 0 : (totalHundredths / 100) * (1 - index / (dayCount - 1))
    days.push({ date, idealHours: Math.round(ideal * 100) / 100, remainingHours: remaining })
  }

  const doneNow = input.scope.filter(
    (task) => statusOnDay(task, histories.get(task.id) ?? [], input.measuredUntil) === 'done',
  )
  return {
    days,
    totalHours: hoursOf(totalHundredths),
    remainingHours: hoursOf(
      totalHundredths -
        doneNow.reduce((sum, task) => sum + (task.estimatedHoursHundredths ?? 0), 0),
    ),
    scopeTasks: input.scope.length,
    doneTasks: doneNow.length,
    unestimatedTasks: input.scope.filter((task) => task.estimatedHoursHundredths === null).length,
  }
}

/** Velocidade de uma sprint encerrada: horas estimadas do escopo concluídas até o fim do dia do encerramento. */
export function sprintVelocityHours(input: {
  readonly closedDay: DateOnly
  readonly scope: readonly Task[]
  readonly events: readonly TimelineEvent[]
  readonly timeZone: string
}): number {
  let total = 0
  for (const task of input.scope) {
    const history = statusHistory(task, input.events, input.timeZone)
    if (statusOnDay(task, history, input.closedDay) === 'done')
      total += task.estimatedHoursHundredths ?? 0
  }
  return hoursOf(total)
}

/**
 * Média de velocidade das últimas sprints encerradas (até `window`, por número da sprint). Nulo sem
 * nenhuma sprint encerrada.
 */
export function averageVelocity(
  points: readonly VelocityPoint[],
  window: number = VELOCITY_WINDOW,
): number | null {
  const recent = [...points].sort((a, b) => b.sprintNumber - a.sprintNumber).slice(0, window)
  if (recent.length === 0) return null
  const sum = recent.reduce((total, point) => total + point.hours, 0)
  return Math.round((sum / recent.length) * 100) / 100
}
