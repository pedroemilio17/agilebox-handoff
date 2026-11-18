import type { Deliverable } from '../entities/deliverable'
import type { Task } from '../entities/task'
import type { DeliverableId, TaskId, UserId } from '../shared/ids'
import { compareDateOnly, diffInDays } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { estimatedCostOf, spentHundredths, total as participationsCost } from './cost'
import { dependencyConflict } from './schedule'

/**
 * Acompanhamento do projeto tradicional (ADR-10, módulo `schedule`). Funções puras: a aplicação lê
 * as tarefas, as entregas, as dependências e os marcos, e aqui se calculam o status de cada marco,
 * a semana atual, o progresso e os totais. Tarefa arquivada fica de fora de tudo.
 */

/**
 * Status do marco: `done` = Cumprido, `at_risk` = Em risco, `on_track` = No prazo. A ordem de
 * decisão está em `milestoneStatus`.
 */
export type MilestoneStatus = 'done' | 'at_risk' | 'on_track'

/** Dependência término→início entre duas tarefas do projeto (só os ids). */
export interface DependencyPair {
  readonly predecessorId: TaskId
  readonly successorId: TaskId
}

/** Campos da tarefa que o status do marco lê. */
export type MilestoneScopeTask = Pick<Task, 'id' | 'status' | 'deadline' | 'archivedAt'>

export interface MilestoneStatusInput {
  /** Data-alvo do marco. */
  readonly dueOn: DateOnly
  readonly today: DateOnly
  /**
   * Tarefas da entrega ligada ao marco e das subentregas (qualquer nível). Nulo quando o marco não
   * tem entrega ligada. O mesmo conjunto serve para a conclusão e para os prazos.
   */
  readonly scope: readonly MilestoneScopeTask[] | null
  /** Dependências do projeto. Só as que ligam duas tarefas do escopo contam para o conflito. */
  readonly dependencies: readonly DependencyPair[]
  /** Tarefas do projeto (para ler as datas das dependências). Podem incluir as de fora do escopo. */
  readonly tasks: readonly Pick<Task, 'id' | 'startsOn' | 'deadline'>[]
}

/**
 * Status de um marco. Com entrega ligada: `done` quando há tarefas ativas no escopo e todas estão
 * concluídas. Senão, `at_risk` quando não está cumprido e (a data já passou, OU alguma tarefa aberta
 * tem prazo depois da data do marco, OU há dependência em conflito entre duas tarefas do escopo).
 * Nos demais casos, `on_track`. Sem entrega ligada, nunca é `done`: `at_risk` só se a data passou.
 * Passou quer dizer data anterior a hoje; no próprio dia o marco ainda não está atrasado.
 */
export function milestoneStatus(input: MilestoneStatusInput): MilestoneStatus {
  const late = compareDateOnly(input.dueOn, input.today) < 0
  if (input.scope === null) return late ? 'at_risk' : 'on_track'

  const active = input.scope.filter((task) => task.archivedAt === null)
  const open = active.filter((task) => task.status !== 'done')
  if (active.length > 0 && open.length === 0) return 'done'

  const deadlineAfter = open.some(
    (task) => task.deadline !== null && compareDateOnly(task.deadline, input.dueOn) > 0,
  )
  const conflict = hasScopeConflict(active, input.dependencies, input.tasks)
  return late || deadlineAfter || conflict ? 'at_risk' : 'on_track'
}

/** Há dependência em conflito entre duas tarefas do escopo (predecessora e sucessora dentro dele). */
export function hasScopeConflict(
  scope: readonly Pick<Task, 'id'>[],
  dependencies: readonly DependencyPair[],
  tasks: readonly Pick<Task, 'id' | 'startsOn' | 'deadline'>[],
): boolean {
  const inScope = new Set<TaskId>(scope.map((task) => task.id))
  const byId = new Map(tasks.map((task) => [task.id, task]))
  return dependencies.some((dependency) => {
    if (!inScope.has(dependency.predecessorId) || !inScope.has(dependency.successorId)) return false
    const predecessor = byId.get(dependency.predecessorId)
    const successor = byId.get(dependency.successorId)
    return predecessor !== undefined && successor !== undefined
      ? dependencyConflict(predecessor, successor)
      : false
  })
}

/** A entrega e todas as subentregas (qualquer nível). O conjunto de visitados evita laço em dado corrompido. */
export function deliverableSubtree(
  rootId: DeliverableId,
  deliverables: readonly Pick<Deliverable, 'id' | 'parentId'>[],
): Set<DeliverableId> {
  const children = new Map<DeliverableId | null, DeliverableId[]>()
  for (const deliverable of deliverables) {
    const group = children.get(deliverable.parentId) ?? []
    group.push(deliverable.id)
    children.set(deliverable.parentId, group)
  }
  const visited = new Set<DeliverableId>()
  const visit = (id: DeliverableId) => {
    if (visited.has(id)) return
    visited.add(id)
    for (const child of children.get(id) ?? []) visit(child)
  }
  visit(rootId)
  return visited
}

/** Próximo marco: o de data mais próxima, com data a partir de hoje e status diferente de cumprido. */
export function nextMilestone<
  T extends { readonly dueOn: DateOnly; readonly status: MilestoneStatus },
>(milestones: readonly T[], today: DateOnly): T | null {
  let next: T | null = null
  for (const milestone of milestones) {
    if (milestone.status === 'done') continue
    if (compareDateOnly(milestone.dueOn, today) < 0) continue
    if (next === null || compareDateOnly(milestone.dueOn, next.dueOn) < 0) next = milestone
  }
  return next
}

/** Dias de calendário de hoje até a data (zero no próprio dia). */
export function daysUntilDate(dueOn: DateOnly, today: DateOnly): number {
  return diffInDays(today, dueOn)
}

export interface TrackingWeek {
  /** Semana em que está hoje, de 1 a `total`. Antes do início vale 1; depois do fim, `total`. */
  readonly current: number
  /** Semanas de calendário cobertas pelo intervalo do cronograma (início e fim incluídos). */
  readonly total: number
}

/** Semana atual e total a partir do intervalo do cronograma. Nulo sem intervalo. */
export function weekOf(
  range: { readonly start: DateOnly; readonly end: DateOnly } | null,
  today: DateOnly,
): TrackingWeek | null {
  if (range === null) return null
  const total = Math.floor(diffInDays(range.start, range.end) / 7) + 1
  const elapsed = Math.floor(diffInDays(range.start, today) / 7) + 1
  return { current: Math.min(total, Math.max(1, elapsed)), total }
}

/**
 * Concluído em inteiro de 0 a 100: horas estimadas das concluídas ÷ horas estimadas totais. Zero
 * quando não há horas. É a mesma regra do rollup da EAP (`rules/wbs.ts`).
 */
export function progressPercent(doneHundredths: number, totalHundredths: number): number {
  if (totalHundredths <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((doneHundredths * 100) / totalHundredths)))
}

export interface TrackingTotals {
  readonly progress: number
  /** Soma das horas estimadas das tarefas ativas (centésimos). */
  readonly plannedHoursHundredths: number
  /** Soma das horas apontadas nas participações das tarefas ativas (centésimos). */
  readonly loggedHoursHundredths: number
  /** Soma do total das participações (horas × valor/hora de cada uma), em centavos. */
  readonly realizedCostCents: number
  /**
   * Horas estimadas × valor/hora do Responsável (ou o padrão dele, se o envolvimento está sem valor).
   * Tarefa sem estimativa, sem Responsável ou sem valor não entra na soma.
   */
  readonly plannedCostCents: number
  readonly tasks: { readonly total: number; readonly done: number }
}

/** Totais do projeto. `defaultRateOf` devolve o valor/hora padrão de um usuário (centavos). */
export function trackingTotals(
  tasks: readonly Task[],
  defaultRateOf: (userId: UserId) => number,
): TrackingTotals {
  const active = tasks.filter((task) => task.archivedAt === null)
  const done = active.filter((task) => task.status === 'done')
  const plannedHours = sumEstimate(active)
  return {
    progress: progressPercent(sumEstimate(done), plannedHours),
    plannedHoursHundredths: plannedHours,
    loggedHoursHundredths: active.reduce(
      (sum, task) => sum + spentHundredths(task.participations),
      0,
    ),
    realizedCostCents: active.reduce(
      (sum, task) => sum + participationsCost(task.participations),
      0,
    ),
    plannedCostCents: active.reduce((sum, task) => sum + plannedCostOf(task, defaultRateOf), 0),
    tasks: { total: active.length, done: done.length },
  }
}

function sumEstimate(tasks: readonly Pick<Task, 'estimatedHoursHundredths'>[]): number {
  return tasks.reduce((sum, task) => sum + (task.estimatedHoursHundredths ?? 0), 0)
}

function plannedCostOf(task: Task, defaultRateOf: (userId: UserId) => number): number {
  const responsible = task.participations.find((item) => item.role === 'responsible')
  if (!responsible || responsible.participant.kind !== 'user') return 0
  return estimatedCostOf(task, defaultRateOf(responsible.participant.userId)) ?? 0
}
