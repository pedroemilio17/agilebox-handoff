import {
  diffInDays,
  TASK_STATUS_LABELS,
  toDateOnly,
  type DateOnly,
  type TaskStatus,
} from '@agilebox/core'
import type { TaskDto, WipColumnDto } from '@agilebox/contract'

/** Ordem dos estados no início do projeto (mesma do quadro). */
export const HOME_STATUS_ORDER: readonly TaskStatus[] = [
  'planning',
  'todo',
  'in_progress',
  'review',
  'done',
]

/** Campos da tarefa que o início usa. A tela passa `TaskDto` inteiro. */
export type HomeTask = Pick<
  TaskDto,
  | 'id'
  | 'key'
  | 'title'
  | 'status'
  | 'inBacklog'
  | 'blockedAt'
  | 'blockedReason'
  | 'overdue'
  | 'deadline'
  | 'updatedAt'
>

export type StatusCounts = Readonly<Record<TaskStatus, number>>

/** Quantas tarefas há em cada estado. Itens de backlog ficam de fora: não estão no quadro. */
export function countByStatus(tasks: readonly HomeTask[]): StatusCounts {
  const counts: Record<TaskStatus, number> = {
    planning: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  }
  for (const task of tasks) {
    if (task.inBacklog === true) continue
    counts[task.status] += 1
  }
  return counts
}

/** Percentual inteiro de `part` sobre `total`; zero quando não há total. */
export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** Tarefas abertas mais recentemente atualizadas, para o bloco "Em destaque". */
export function highlightTasks<T extends HomeTask>(tasks: readonly T[], limit: number): T[] {
  return tasks
    .filter((task) => task.status !== 'done' && task.inBacklog !== true)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit)
}

export interface AttentionItem {
  readonly key: string
  readonly tone: 'danger' | 'warning'
  readonly title: string
  readonly meta: string
  /** Tarefa a abrir; nulo quando o item é o quadro inteiro (WIP). */
  readonly taskId: string | null
}

/**
 * Itens que pedem atenção, só com o que o servidor já informa: bloqueio, prazo vencido e coluna
 * acima do limite de WIP. Não há limite de dias inventado para "parada".
 */
export function attentionItems(
  tasks: readonly HomeTask[],
  wipColumns: readonly WipColumnDto[],
  today: DateOnly,
  timeZone: string,
): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const task of tasks) {
    if (task.inBacklog === true) continue
    if (task.blockedAt !== null) {
      const since = toDateOnly(new Date(task.blockedAt), timeZone)
      items.push({
        key: `blocked-${task.id}`,
        tone: 'danger',
        title: `${task.key} bloqueada ${sinceLabel(diffInDays(since, today))}`,
        meta: task.blockedReason ?? 'Sem motivo informado',
        taskId: task.id,
      })
    }
  }
  for (const task of tasks) {
    if (task.inBacklog === true || task.overdue !== true) continue
    items.push({
      key: `overdue-${task.id}`,
      tone: 'danger',
      title: `${task.key} com prazo vencido`,
      meta: task.deadline ? `Prazo em ${dayMonthLabel(task.deadline)}` : 'Prazo vencido',
      taskId: task.id,
    })
  }
  for (const column of wipColumns) {
    if (column.state !== 'over' || column.limit === null) continue
    items.push({
      key: `wip-${column.status}`,
      tone: 'warning',
      title: `Coluna ${TASK_STATUS_LABELS[column.status]} acima do limite de WIP`,
      meta: `${column.count} de ${column.limit} tarefas`,
      taskId: null,
    })
  }
  return items
}

function sinceLabel(days: number): string {
  if (days <= 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

/** "2026-11-04" vira "04/11". */
export function dayMonthLabel(dateOnly: string): string {
  const [, month = '', day = ''] = dateOnly.split('-')
  return `${day}/${month}`
}

/** Texto do tempo que resta da sprint, a partir de dias até o fim planejado. */
export function sprintDaysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Prazo passou há ${Math.abs(daysLeft)} dias`
  if (daysLeft === 0) return 'Termina hoje'
  if (daysLeft === 1) return 'Resta 1 dia'
  return `Restam ${daysLeft} dias`
}
