import type { Deliverable } from '../entities/deliverable'
import type { Milestone } from '../entities/milestone'
import type { Task } from '../entities/task'
import type { DeliverableId } from '../shared/ids'
import type { TaskStatus } from '../values/task-status'
import { total as participationsCost } from './cost'
import { deliverableCodes } from './deliverable-tree'

/**
 * Leitura consolidada da EAP (ADR-10, `wbs.get`). Função pura: recebe as entregas, as tarefas e os
 * marcos do projeto e devolve a árvore em ordem de exibição, com os totais de cada entrega somando as
 * subentregas. Tarefa arquivada fica de fora. Quem chama decide o que mostrar de cada valor.
 */

export interface WbsTotals {
  /** Soma das estimativas das tarefas (centésimos de hora). Tarefa sem estimativa conta zero. */
  readonly hoursHundredths: number
  /** Custo realizado: horas apontadas × valor/hora de cada envolvido (`rules/cost.ts`), em centavos. */
  readonly costCents: number
  /** Inteiro de 0 a 100: horas concluídas ÷ horas totais. Zero quando não há horas. */
  readonly progress: number
  /** Tarefas da entrega e das subentregas. */
  readonly tasks: number
  /** Marcos ligados à entrega ou a uma subentrega. */
  readonly milestones: readonly Milestone[]
}

export interface WbsSummary {
  readonly deliverables: number
  readonly tasks: number
  readonly hoursHundredths: number
  readonly costCents: number
  readonly progress: number
}

export interface WbsDeliverableRow {
  readonly kind: 'deliverable'
  readonly deliverable: Deliverable
  /** Código hierárquico ("1", "1.2", "2.2.1"), calculado pela ordem dos irmãos. */
  readonly code: string
  /** Nível: 1 para a raiz da EAP. */
  readonly level: number
  readonly totals: WbsTotals
}

export interface WbsTaskRow {
  readonly kind: 'task'
  readonly task: Task
  readonly deliverableId: DeliverableId
}

export type WbsRow = WbsDeliverableRow | WbsTaskRow

export interface WbsTree {
  /** Entregas e tarefas em ordem de exibição: cada entrega, suas subentregas e depois suas tarefas. */
  readonly rows: readonly WbsRow[]
  readonly summary: WbsSummary
  /** Tarefas ativas do projeto que não apontam para nenhuma entrega. */
  readonly tasksWithoutDeliverable: number
}

export interface WbsInput {
  readonly deliverables: readonly Deliverable[]
  readonly tasks: readonly Task[]
  readonly milestones: readonly Milestone[]
}

/** Ordem entre irmãos: a mesma de `deliverableCodes` (posição e, em empate, id). */
function bySiblingOrder(a: Deliverable, b: Deliverable): number {
  return a.position - b.position || a.id.localeCompare(b.id)
}

function progressOf(hoursHundredths: number, doneHundredths: number): number {
  if (hoursHundredths <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((doneHundredths * 100) / hoursHundredths)))
}

function costOf(tasks: readonly Task[]): number {
  return tasks.reduce((sum, task) => sum + participationsCost(task.participations), 0)
}

export function buildWbs(input: WbsInput): WbsTree {
  const active = input.tasks.filter((task) => task.archivedAt === null)
  const codes = deliverableCodes(input.deliverables)

  const children = new Map<DeliverableId | null, Deliverable[]>()
  for (const deliverable of input.deliverables) {
    if (!codes.has(deliverable.id)) continue
    const group = children.get(deliverable.parentId) ?? []
    group.push(deliverable)
    children.set(deliverable.parentId, group)
  }
  for (const group of children.values()) group.sort(bySiblingOrder)

  const tasksByDeliverable = new Map<DeliverableId, Task[]>()
  for (const task of active) {
    if (task.deliverableId === null) continue
    const group = tasksByDeliverable.get(task.deliverableId) ?? []
    group.push(task)
    tasksByDeliverable.set(task.deliverableId, group)
  }
  for (const group of tasksByDeliverable.values()) group.sort((a, b) => a.number - b.number)

  /** A entrega e todos os descendentes. O conjunto de visitados evita laço em dado corrompido. */
  const subtreeOf = (id: DeliverableId, visited = new Set<DeliverableId>()): Set<DeliverableId> => {
    if (visited.has(id)) return visited
    visited.add(id)
    for (const child of children.get(id) ?? []) subtreeOf(child.id, visited)
    return visited
  }

  const totalsOf = (ids: ReadonlySet<DeliverableId>): WbsTotals => {
    const inside = active.filter(
      (task) => task.deliverableId !== null && ids.has(task.deliverableId),
    )
    const hours = sumHours(inside)
    const done = sumHours(inside.filter((task) => isDone(task.status)))
    return {
      hoursHundredths: hours,
      costCents: costOf(inside),
      progress: progressOf(hours, done),
      tasks: inside.length,
      milestones: input.milestones.filter(
        (milestone) => milestone.deliverableId !== null && ids.has(milestone.deliverableId),
      ),
    }
  }

  const rows: WbsRow[] = []
  const visit = (parentId: DeliverableId | null) => {
    for (const deliverable of children.get(parentId) ?? []) {
      const code = codes.get(deliverable.id) ?? ''
      rows.push({
        kind: 'deliverable',
        deliverable,
        code,
        level: code.split('.').length,
        totals: totalsOf(subtreeOf(deliverable.id)),
      })
      visit(deliverable.id)
      for (const task of tasksByDeliverable.get(deliverable.id) ?? [])
        rows.push({ kind: 'task', task, deliverableId: deliverable.id })
    }
  }
  visit(null)

  const allHours = sumHours(active)
  return {
    rows,
    summary: {
      deliverables: codes.size,
      tasks: active.length,
      hoursHundredths: allHours,
      costCents: costOf(active),
      progress: progressOf(allHours, sumHours(active.filter((task) => isDone(task.status)))),
    },
    tasksWithoutDeliverable: active.filter((task) => task.deliverableId === null).length,
  }
}

function isDone(status: TaskStatus): boolean {
  return status === 'done'
}

function sumHours(tasks: readonly Task[]): number {
  return tasks.reduce((sum, task) => sum + (task.estimatedHoursHundredths ?? 0), 0)
}
