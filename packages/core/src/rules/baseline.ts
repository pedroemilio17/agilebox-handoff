import type { BaselineTask } from '../entities/baseline'
import type { Task } from '../entities/task'
import type { TaskId, UserId } from '../shared/ids'
import { ValidationError } from '../shared/errors'
import { compareDateOnly, diffInDays } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { estimatedCostOf } from './cost'

/**
 * Linha de base (ADR-10, módulo `baseline`). Funções puras: a aplicação lê a foto e as tarefas
 * atuais, e aqui se calculam os desvios por tarefa e o resumo do projeto. Dias são de calendário:
 * positivo = atrasou (depois do planejado), negativo = adiantou.
 */

/**
 * Situação de uma tarefa frente à foto. `late` = Atrasada (início ou fim depois do planejado),
 * `on_time` = No prazo, `new` = Nova (não estava na foto), `removed` = Removida (saiu do projeto ou
 * foi arquivada depois da foto).
 */
export type DeviationStatus = 'on_time' | 'late' | 'new' | 'removed'

/** Desvio de uma tarefa. Diferenças nulas quando falta um dos lados ou o dado. */
export interface TaskDeviation {
  readonly taskId: TaskId
  readonly title: string
  readonly status: DeviationStatus
  /** Maior atraso entre início e fim (negativo se adiantou nos dois). Nulo sem data comparável. */
  readonly delayDays: number | null
  readonly startDelayDays: number | null
  readonly endDelayDays: number | null
  /** Horas atuais menos as da foto (centésimos). */
  readonly hoursDeltaHundredths: number | null
  /** Custo atual menos o da foto (centavos). */
  readonly costDeltaCents: number | null
}

/**
 * Plano atual de uma tarefa ativa, na forma da foto. O custo vem do Responsável (como a estimativa);
 * `costOn` falso deixa o custo nulo, como na foto de um projeto sem o módulo `cost`.
 */
export function planOf(
  task: Task,
  defaultRateOf: (userId: UserId) => number,
  costOn: boolean,
): BaselineTask {
  return {
    taskId: task.id,
    title: task.title,
    startsOn: task.startsOn,
    endsOn: task.deadline,
    estimatedHoursHundredths: task.estimatedHoursHundredths,
    plannedCostCents: costOn ? plannedCostOf(task, defaultRateOf) : null,
  }
}

/**
 * A tarefa entra na comparação se estava na foto ou se foi criada depois dela. Tarefa antiga que não
 * tinha datas na foto fica de fora: ela não fazia parte do plano, então não é "nova".
 */
export function isInComparison(
  task: { readonly id: TaskId; readonly createdAt: string },
  plannedIds: ReadonlySet<TaskId>,
  takenAt: string,
): boolean {
  return plannedIds.has(task.id) || Date.parse(task.createdAt) > Date.parse(takenAt)
}

/** A tarefa entra na foto só com alguma data (início ou fim), como manda o módulo. */
export function hasPlanDates(plan: BaselineTask): boolean {
  return plan.startsOn !== null || plan.endsOn !== null
}

/**
 * Compara a tarefa da foto com a atual. `planned` nulo = tarefa nova; `current` nulo = removida.
 * Atrasada quando o maior atraso de início ou fim passa de zero.
 */
export function taskDeviation(
  planned: BaselineTask | null,
  current: BaselineTask | null,
): TaskDeviation {
  if (current === null) {
    if (planned === null) throw new ValidationError('Desvio sem tarefa de referência')
    return deviation(planned.taskId, planned.title, 'removed', null, null, null, null, null)
  }
  if (planned === null)
    return deviation(current.taskId, current.title, 'new', null, null, null, null, null)
  const startDelayDays = daysBetween(planned.startsOn, current.startsOn)
  const endDelayDays = daysBetween(planned.endsOn, current.endsOn)
  const delayDays = largest(startDelayDays, endDelayDays)
  return deviation(
    current.taskId,
    current.title,
    delayDays !== null && delayDays > 0 ? 'late' : 'on_time',
    delayDays,
    startDelayDays,
    endDelayDays,
    minus(current.estimatedHoursHundredths, planned.estimatedHoursHundredths),
    minus(current.plannedCostCents, planned.plannedCostCents),
  )
}

export interface BaselineSummary {
  /** Fim planejado do projeto: o maior fim da foto. Nulo sem fim na foto. */
  readonly plannedEnd: DateOnly | null
  /** Fim atual do projeto: o maior prazo das tarefas ativas. Nulo sem prazo. */
  readonly currentEnd: DateOnly | null
  /** Dias entre o fim atual e o planejado (positivo = atrasado). Nulo sem os dois. */
  readonly endDeviationDays: number | null
  readonly plannedHoursHundredths: number
  readonly currentHoursHundredths: number
  /** Custo da foto e atual, em centavos. Nulo quando nenhuma tarefa tem valor (não é zero). */
  readonly plannedCostCents: number | null
  readonly currentCostCents: number | null
}

/** Resumo do projeto: fim, horas e custo da foto contra o estado atual. */
export function baselineSummary(
  planned: readonly BaselineTask[],
  current: readonly BaselineTask[],
): BaselineSummary {
  const plannedEnd = latest(planned.map((item) => item.endsOn))
  const currentEnd = latest(current.map((item) => item.endsOn))
  return {
    plannedEnd,
    currentEnd,
    endDeviationDays: daysBetween(plannedEnd, currentEnd),
    plannedHoursHundredths: sum(planned.map((item) => item.estimatedHoursHundredths)),
    currentHoursHundredths: sum(current.map((item) => item.estimatedHoursHundredths)),
    plannedCostCents: sumKnown(planned.map((item) => item.plannedCostCents)),
    currentCostCents: sumKnown(current.map((item) => item.plannedCostCents)),
  }
}

function deviation(
  taskId: TaskId,
  title: string,
  status: DeviationStatus,
  delayDays: number | null,
  startDelayDays: number | null,
  endDelayDays: number | null,
  hoursDeltaHundredths: number | null,
  costDeltaCents: number | null,
): TaskDeviation {
  return {
    taskId,
    title,
    status,
    delayDays,
    startDelayDays,
    endDelayDays,
    hoursDeltaHundredths,
    costDeltaCents,
  }
}

/** Dias de `from` até `to` (positivo = `to` depois). Nulo se algum lado não tem data. */
function daysBetween(from: DateOnly | null, to: DateOnly | null): number | null {
  return from === null || to === null ? null : diffInDays(from, to)
}

/** Diferença `current - reference`, quando os dois lados existem. */
function minus(current: number | null, reference: number | null): number | null {
  return current === null || reference === null ? null : current - reference
}

/** Maior valor entre os que existem; nulo se nenhum existe. Sem atraso (zero) não é ausência. */
function largest(...values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length === 0 ? null : Math.max(...present)
}

function latest(values: readonly (DateOnly | null)[]): DateOnly | null {
  let result: DateOnly | null = null
  for (const value of values) {
    if (value === null) continue
    if (result === null || compareDateOnly(value, result) > 0) result = value
  }
  return result
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

/** Soma dos valores conhecidos; nulo quando nenhum é conhecido (sem dado, não zero). */
function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null)
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0)
}

function plannedCostOf(task: Task, defaultRateOf: (userId: UserId) => number): number | null {
  const responsible = task.participations.find((item) => item.role === 'responsible')
  if (!responsible || responsible.participant.kind !== 'user') return null
  return estimatedCostOf(task, defaultRateOf(responsible.participant.userId))
}
