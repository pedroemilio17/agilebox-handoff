import { ValidationError } from '../shared/errors'

export const TASK_STATUSES = ['planning', 'todo', 'in_progress', 'review', 'done'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  planning: 'Planejamento',
  todo: 'A fazer',
  in_progress: 'Desenvolvendo',
  review: 'Revisar',
  done: 'Concluído',
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.some((status) => status === value)
}

export function parseTaskStatus(value: string): TaskStatus {
  if (!isTaskStatus(value)) {
    throw new ValidationError('Estado da tarefa inválido')
  }
  return value
}
